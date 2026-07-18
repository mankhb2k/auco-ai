import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly realtime: RealtimeService) {}

  afterInit() {
    this.realtime.register(this);
    this.logger.log('WebSocket gateway ready at namespace /ws');
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { taskRunId?: string; automationId?: string },
  ) {
    const rooms: string[] = [];
    const taskRunId = body?.taskRunId?.trim();
    const automationId = body?.automationId?.trim();
    if (taskRunId) {
      void client.join(`taskRun:${taskRunId}`);
      rooms.push(`taskRun:${taskRunId}`);
    }
    if (automationId) {
      void client.join(`automation:${automationId}`);
      rooms.push(`automation:${automationId}`);
    }
    if (!rooms.length) {
      return { ok: false, error: 'taskRunId or automationId required' };
    }
    this.logger.debug(`Client ${client.id} joined ${rooms.join(',')}`);
    return { ok: true, rooms };
  }

  emitToTask(taskRunId: string, event: string, payload: unknown) {
    this.server?.to(`taskRun:${taskRunId}`).emit(event, payload);
  }

  emitToAutomation(automationId: string, event: string, payload: unknown) {
    this.server?.to(`automation:${automationId}`).emit(event, payload);
  }
}
