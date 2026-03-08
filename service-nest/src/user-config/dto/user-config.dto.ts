import { IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class ServiceConfigDto {
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

export class UpdateUserConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceConfigDto)
  sora?: ServiceConfigDto

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceConfigDto)
  veo?: ServiceConfigDto

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceConfigDto)
  geminiImage?: ServiceConfigDto

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceConfigDto)
  grok?: ServiceConfigDto
}

export class UpdateUserServiceConfigDto {
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
  channel?: string
}
