import { IsString, IsNumber, IsOptional, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class SoraConfigDto {
  @IsOptional()
  @IsString()
  server?: string

  @IsOptional()
  @IsString()
  key?: string

  @IsOptional()
  @IsString()
  characterServer?: string

  @IsOptional()
  @IsString()
  characterKey?: string
}

export class VeoConfigDto {
  @IsOptional()
  @IsString()
  server?: string

  @IsOptional()
  @IsString()
  key?: string
}

export class GeminiImageConfigDto {
  @IsOptional()
  @IsString()
  server?: string

  @IsOptional()
  @IsString()
  key?: string
}

export class GrokConfigDto {
  @IsOptional()
  @IsString()
  server?: string

  @IsOptional()
  @IsString()
  key?: string
}

export class GrokImageConfigDto {
  @IsOptional()
  @IsString()
  server?: string

  @IsOptional()
  @IsString()
  key?: string
}

export class UpdateConfigDto {
  @IsOptional()
  @IsNumber()
  port?: number

  @IsOptional()
  @ValidateNested()
  @Type(() => SoraConfigDto)
  sora?: SoraConfigDto

  @IsOptional()
  @ValidateNested()
  @Type(() => VeoConfigDto)
  veo?: VeoConfigDto

  @IsOptional()
  @ValidateNested()
  @Type(() => GeminiImageConfigDto)
  geminiImage?: GeminiImageConfigDto

  @IsOptional()
  @ValidateNested()
  @Type(() => GrokConfigDto)
  grok?: GrokConfigDto

  @IsOptional()
  @ValidateNested()
  @Type(() => GrokImageConfigDto)
  grokImage?: GrokImageConfigDto
}

export class UpdateServiceConfigDto {
  @IsOptional()
  @IsString()
  server?: string

  @IsOptional()
  @IsString()
  key?: string

  @IsOptional()
  @IsString()
  characterServer?: string

  @IsOptional()
  @IsString()
  characterKey?: string

  @IsOptional()
  @IsString()
  url?: string

  @IsOptional()
  @IsString()
  content?: string
}
