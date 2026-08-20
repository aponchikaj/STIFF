import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { normalizeGeorgianPhone, normalizePostalCode } from '../orders/georgia';
import { SaveAddressDto } from './dto/customers.dto';
import { UserAddress } from './user-address.entity';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(UserAddress)
    private readonly addressRepo: Repository<UserAddress>,
    private readonly dataSource: DataSource,
  ) {}

  list(userId: string): Promise<UserAddress[]> {
    return this.addressRepo.find({
      where: { userId },
      // Default first — it is the one checkout will pick.
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
  }

  async create(userId: string, dto: SaveAddressDto): Promise<UserAddress> {
    const existing = await this.addressRepo.count({ where: { userId } });
    // The first address someone saves is their default; there is nothing else
    // for checkout to choose.
    const isDefault = dto.isDefault === true || existing === 0;

    return this.dataSource.transaction(async (manager) => {
      if (isDefault) await this.clearDefault(manager, userId);
      const repo = manager.getRepository(UserAddress);
      return repo.save(repo.create({ userId, ...this.clean(dto), isDefault }));
    });
  }

  async update(
    userId: string,
    id: string,
    dto: SaveAddressDto,
  ): Promise<UserAddress> {
    const address = await this.addressRepo.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UserAddress);
      if (dto.isDefault === true && !address.isDefault) {
        await this.clearDefault(manager, userId);
        address.isDefault = true;
      }
      Object.assign(address, this.clean(dto));
      return repo.save(address);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.addressRepo.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UserAddress);
      await repo.delete({ id });
      if (!address.isDefault) return;
      // Never leave someone with addresses but no default — checkout would
      // have nothing to preselect.
      const next = await repo.findOne({
        where: { userId },
        order: { updatedAt: 'DESC' },
      });
      if (next) {
        next.isDefault = true;
        await repo.save(next);
      }
    });
  }

  private async clearDefault(
    manager: { getRepository: typeof DataSource.prototype.getRepository },
    userId: string,
  ): Promise<void> {
    await manager
      .getRepository(UserAddress)
      .update({ userId, isDefault: true }, { isDefault: false });
  }

  /** Applies the Georgian address shape — see `orders/georgia.ts`. */
  private clean(dto: SaveAddressDto) {
    const phone = normalizeGeorgianPhone(dto.phone);
    if (!phone) {
      throw new BadRequestException(
        'Enter a Georgian phone number, for example 555 12 34 56.',
      );
    }
    return {
      label: dto.label?.trim() ?? '',
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      line1: dto.line1?.trim() ?? '',
      line2: dto.line2?.trim() || null,
      city: dto.city?.trim() ?? '',
      region: dto.region?.trim() || null,
      postalCode: normalizePostalCode(dto.postalCode),
      country: dto.country?.trim() || 'Georgia',
      phone,
    };
  }
}
