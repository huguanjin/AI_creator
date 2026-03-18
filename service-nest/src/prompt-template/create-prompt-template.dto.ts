import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator'

export class CreatePromptTemplateDto {
  @IsString()
  name: string

  @IsString()
  content: string

  @IsString()
  @IsOptional()
  category?: string

  @IsNumber()
  @IsOptional()
  sort?: number

  @IsBoolean()
  @IsOptional()
  enabled?: boolean
}
