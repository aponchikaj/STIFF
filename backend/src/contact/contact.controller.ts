import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ContactService } from './contact.service';
import {
  ListContactQueryDto,
  ReplyContactDto,
  SetHandledDto,
  SubmitContactDto,
} from './dto/contact.dto';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async submit(@Body() dto: SubmitContactDto) {
    await this.contactService.submit(dto);
    return { success: true };
  }

  @Get()
  @Roles('admin')
  list(@Query() query: ListContactQueryDto) {
    return this.contactService.list(query);
  }

  @Post(':id/reply')
  @Roles('admin')
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyContactDto) {
    return this.contactService.reply(id, dto.message);
  }

  @Patch(':id/handled')
  @Roles('admin')
  setHandled(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetHandledDto,
  ) {
    return this.contactService.setHandled(id, dto.handled);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.contactService.remove(id);
    return { success: true };
  }
}
