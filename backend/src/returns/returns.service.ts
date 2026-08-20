import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Paginated, paginate } from '../common/types/paginated';
import { ContentService } from '../content/content.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Order } from '../orders/order.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateReturnDto, ResolveReturnDto } from './dto/returns.dto';
import { ReturnRequestItem } from './return-request-item.entity';
import {
  OPEN_RETURN_STATUSES,
  ReturnRequest,
  ReturnStatus,
} from './return-request.entity';
import {
  canRequestReturn,
  canTransition,
  isResolved,
  parseWindowDays,
} from './return-rules';

@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(ReturnRequest)
    private readonly returnRepo: Repository<ReturnRequest>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly contentService: ContentService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  /** Admin-configured, so the window can move without a deploy. */
  private async windowDays(): Promise<number> {
    const content = await this.contentService.get('storefront');
    return parseWindowDays(
      content.value.returnWindowDays as string | undefined,
    );
  }

  /**
   * What the receipt page needs to decide whether to offer the button, and
   * what to say when it cannot.
   */
  async eligibility(order: Order): Promise<{
    allowed: boolean;
    reason?: string;
    closesAt?: Date;
    openRequestId?: string;
  }> {
    const open = await this.returnRepo.findOne({
      where: { orderId: order.id, status: In(OPEN_RETURN_STATUSES) },
    });
    if (open) {
      return {
        allowed: false,
        reason: 'A return is already open on this order.',
        openRequestId: open.id,
      };
    }
    return canRequestReturn(order, await this.windowDays());
  }

  async create(order: Order, dto: CreateReturnDto): Promise<ReturnRequest> {
    const eligible = await this.eligibility(order);
    if (!eligible.allowed) {
      throw new BadRequestException(
        eligible.reason ?? 'This order cannot be returned.',
      );
    }

    const byId = new Map(order.items.map((item) => [item.id, item]));
    const lines = dto.items.map((line) => {
      const item = byId.get(line.orderItemId);
      if (!item) {
        throw new BadRequestException('That item is not on this order.');
      }
      if (line.quantity > item.quantity) {
        throw new BadRequestException(
          `You only ordered ${item.quantity} of ${item.productName}.`,
        );
      }
      return { orderItemId: line.orderItemId, quantity: line.quantity };
    });
    if (lines.length === 0) {
      throw new BadRequestException('Pick at least one item to send back.');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const request = await manager.save(
        manager.create(ReturnRequest, {
          orderId: order.id,
          status: 'requested' as ReturnStatus,
          reason: dto.reason?.trim() ?? '',
        }),
      );
      await manager.save(
        lines.map((line) =>
          manager.create(ReturnRequestItem, {
            returnRequestId: request.id,
            ...line,
          }),
        ),
      );
      return request;
    });

    void this.mailService.sendReturnUpdate(this.emailFor(order), order, saved);
    return this.getOne(saved.id);
  }

  async getOne(id: string): Promise<ReturnRequest> {
    const request = await this.returnRepo.findOne({
      where: { id },
      relations: { items: true, order: { items: true } },
    });
    if (!request) throw new NotFoundException('Return request not found');
    return request;
  }

  async listForOrder(orderId: string): Promise<ReturnRequest[]> {
    return this.returnRepo.find({
      where: { orderId },
      relations: { items: true },
      order: { createdAt: 'DESC' },
    });
  }

  async adminList(
    query: PaginationDto & { status?: ReturnStatus },
  ): Promise<Paginated<ReturnRequest>> {
    const [items, total] = await this.returnRepo.findAndCount({
      where: query.status ? { status: query.status } : {},
      relations: { items: true, order: true },
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.pageSize,
    });
    return paginate(items, total, query.page, query.pageSize);
  }

  /**
   * Moves a request along its state machine.
   *
   * The machine is what stops a rejected return being quietly refunded later,
   * so an illegal move is refused rather than clamped to something adjacent.
   */
  async resolve(id: string, dto: ResolveReturnDto): Promise<ReturnRequest> {
    const request = await this.getOne(id);
    if (!canTransition(request.status, dto.status)) {
      throw new BadRequestException(
        `A ${request.status} return cannot become ${dto.status}.`,
      );
    }
    if (dto.status === 'rejected' && !dto.resolutionNote?.trim()) {
      // A refusal the customer cannot understand is worse than no answer.
      throw new BadRequestException('Say why the return was rejected.');
    }

    request.status = dto.status;
    if (dto.resolutionNote !== undefined) {
      request.resolutionNote = dto.resolutionNote.trim();
    }
    if (dto.refundCents !== undefined) request.refundCents = dto.refundCents;
    if (isResolved(dto.status)) request.resolvedAt = new Date();
    await this.returnRepo.save(request);

    const order = await this.orderRepo.findOne({
      where: { id: request.orderId },
    });
    if (order) {
      if (order.userId) {
        await this.notificationsService.notify(
          order.userId,
          'order_status',
          'Return update',
          RETURN_MESSAGES[dto.status],
          { orderId: order.id },
        );
      }
      void this.mailService.sendReturnUpdate(
        this.emailFor(order),
        order,
        request,
      );
    }
    return this.getOne(id);
  }

  private emailFor(order: Order): string {
    return order.guestEmail ?? order.user?.email ?? '';
  }
}

const RETURN_MESSAGES: Record<ReturnStatus, string> = {
  requested: 'We have your return request and will be in touch.',
  approved: 'Your return is approved — send the pieces back to us.',
  rejected: 'We could not accept this return.',
  received: 'Your return arrived with us. The refund is next.',
  refunded: 'Your refund has been sent.',
};
