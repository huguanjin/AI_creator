import { IsString, IsNotEmpty } from 'class-validator'

export class QueryAssetDto {
  @IsString()
  @IsNotEmpty()
  id: string
}
