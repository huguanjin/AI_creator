import { IsString, IsOptional } from 'class-validator'

export class PolishPromptDto {
  @IsString()
  prompt: string

  @IsString()
  @IsOptional()
  model?: string
}
