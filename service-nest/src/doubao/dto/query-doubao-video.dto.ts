import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator'

export class QueryDoubaoVideoDto {
  @IsString()
  @IsNotEmpty()
  id: string

  @IsOptional()
  @IsString()
  @IsIn(['aifast', 'xiaohumini', 'seedance2'])
  channel?: string
}
