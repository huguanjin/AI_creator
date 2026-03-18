import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator'

export class UpdatePromptTemplateDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  content?: string

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
