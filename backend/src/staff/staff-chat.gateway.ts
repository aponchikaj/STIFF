import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { StaffChatService } from './staff-chat.service';
import {
  STAFF_ACCESS_COOKIE,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
} from './staff.constants';
import type { StaffAccessPayload } from './staff-jwt.guard';
import { StaffUsersService } from './staff-users.service';

function cookieValue(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

interface StaffSocketData {
  staffUserId?: string;
}

function staffSocketData(client: Socket): StaffSocketData {
  return client.data as StaffSocketData;
}

@WebSocketGateway({ namespace: '/staff' })
export class StaffChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(StaffChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly staffUsersService: StaffUsersService,
    private readonly staffChatService: StaffChatService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.readToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = await this.jwtService.verifyAsync<StaffAccessPayload>(
        token,
        {
          secret:
            this.configService.get<string>('STAFF_JWT_ACCESS_SECRET') ??
            this.configService.get<string>('JWT_ACCESS_SECRET'),
          audience: STAFF_JWT_AUDIENCE,
          issuer: STAFF_JWT_ISSUER,
        },
      );
      const user = await this.staffUsersService.findById(payload.sub);
      if (!user || user.isBlocked) {
        client.disconnect(true);
        return;
      }
      staffSocketData(client).staffUserId = user.id;
      await client.join(`staff:user:${user.id}`);
    } catch (err) {
      this.logger.debug(
        `Staff socket rejected: ${err instanceof Error ? err.message : String(err)}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = staffSocketData(client).staffUserId;
    if (userId) {
      this.server.to(`staff:user:${userId}`).emit('presence', {
        userId,
        online: false,
      });
    }
  }

  @SubscribeMessage('join')
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = this.requireUser(client);
    const conversationId = body?.conversationId;
    if (!conversationId) return { ok: false };
    const members = await this.staffChatService.memberIds(conversationId);
    if (!members.includes(userId)) return { ok: false };
    await client.join(`staff:chat:${conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('message')
  async message(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string; text?: string },
  ) {
    const userId = this.requireUser(client);
    if (!body?.conversationId || !body.text) return { ok: false };
    const user = await this.staffUsersService.findById(userId);
    if (!user) return { ok: false };
    const saved = await this.staffChatService.sendMessage(
      user,
      body.conversationId,
      body.text,
    );
    this.server.to(`staff:chat:${body.conversationId}`).emit('message', saved);
    return { ok: true, message: saved };
  }

  @SubscribeMessage('typing')
  typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const userId = this.requireUser(client);
    if (!body?.conversationId) return;
    client.to(`staff:chat:${body.conversationId}`).emit('typing', {
      conversationId: body.conversationId,
      userId,
    });
  }

  emitMessage(conversationId: string, payload: unknown): void {
    this.server.to(`staff:chat:${conversationId}`).emit('message', payload);
  }

  private requireUser(client: Socket): string {
    const userId = staffSocketData(client).staffUserId;
    if (!userId) {
      client.disconnect(true);
      throw new Error('unauthenticated socket');
    }
    return userId;
  }

  private readToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as { token?: string };
    if (auth?.token) return auth.token;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return cookieValue(client.handshake.headers.cookie, STAFF_ACCESS_COOKIE);
  }
}
