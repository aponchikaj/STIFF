import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { ToggleReactionDto } from './dto/reactions.dto';
import { ReactionsService } from './reactions.service';

@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post('toggle')
  @HttpCode(200)
  toggle(@CurrentUser() user: User, @Body() dto: ToggleReactionDto) {
    return this.reactionsService.toggle(user, dto);
  }
}
