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
    @MessageBody() body: { taskRunId?: string },
  ) {
    const id = body?.taskRunId?.trim();
    if (!id) return { ok: false, error: 'taskRunId required' };
    void client.join(`taskRun:${id}`);
    this.logger.debug(`Client ${client.id} joined taskRun:${id}`);
    return { ok: true, room: `taskRun:${id}` };
  }

  emitToTask(taskRunId: string, event: string, payload: unknown) {
    this.server?.to(`taskRun:${taskRunId}`).emit(event, payload);
  }
}
