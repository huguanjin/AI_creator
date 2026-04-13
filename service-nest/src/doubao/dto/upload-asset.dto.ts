import { IsOptional, IsString } from 'class-validator'

export class UploadAssetDto {
  @IsOptional()
  @IsString()
  type?: string

  @IsOptional()
  @IsString()
  url?: string

  @IsOptional()
  @IsString()
  content?: string
}
