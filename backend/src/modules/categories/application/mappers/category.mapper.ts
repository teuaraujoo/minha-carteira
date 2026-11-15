import { Category } from "../../domain/entities/category.entity.js";
import type { CategoryStatus } from "../../domain/enums/category.enums.js";
import type { CategoryResponseDto } from "../dto/category.dto.js";

export interface CategoryRecord {
  id: string;
  userId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Converte registros de persistência e entidades de categoria em DTOs de resposta. */
export class CategoryMapper {
  static toEntity(record: CategoryRecord): Category {
    return new Category({
      id: record.id,
      userId: record.userId,
      name: record.name,
      color: record.color,
      icon: record.icon,
      isDefault: record.isDefault,
      status: record.status as CategoryStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toDto(category: Category): CategoryResponseDto {
    return {
      id: category.id,
      userId: category.userId,
      name: category.name,
      color: category.color,
      icon: category.icon,
      isDefault: category.isDefault,
      status: category.status,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}

export const toCategoryResponseDto = CategoryMapper.toDto;
