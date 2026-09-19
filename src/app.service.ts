import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'Project Management API',
      docs: '/api/docs',
      health: '/health',
    };
  }
}
