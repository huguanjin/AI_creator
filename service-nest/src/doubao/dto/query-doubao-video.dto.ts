import { IsString, IsNotEmpty } from 'class-validator'

export class QueryDoubaoVideoDto {
  @IsString()
  @IsNotEmpty()
  id: string
}
