import type { SchemaField } from '@agentsync/types';
import type { SchemaService } from './schema.service.js';

export interface ConstraintViolation {
	field: string;
	code: string;
	message: string;
}

export class ConstraintService {
	constructor(private schemaService: SchemaService) {}

	/**
	 * Validate data against field constraints.
	 * Returns array of violations (empty = valid).
	 */
	async validate(
		tableId: string,
		data: Record<string, unknown>,
		existingData?: Record<string, unknown>,
	): Promise<ConstraintViolation[]> {
		const fields = (await this.schemaService.getFieldsForTable(
			tableId,
		)) as unknown as SchemaField[];
		const violations: ConstraintViolation[] = [];

		for (const field of fields) {
			// Skip computed fields entirely
			if (field.fieldType === 'formula' || field.fieldType === 'rollup') continue;

			const value = data[field.slug];
			const existingValue = existingData?.[field.slug];
			const isUpdate = existingData !== undefined;

			// Required field check (only on create, or if field is being set to null/undefined)
			if (field.isRequired) {
				if (!isUpdate && (value === undefined || value === null || value === '')) {
					violations.push({
						field: field.slug,
						code: 'REQUIRED_FIELD_MISSING',
						message: `Field '${field.name}' is required`,
					});
					continue;
				}
				if (isUpdate && field.slug in data && (value === null || value === '')) {
					violations.push({
						field: field.slug,
						code: 'REQUIRED_FIELD_MISSING',
						message: `Field '${field.name}' cannot be empty`,
					});
					continue;
				}
			}

			if (value === undefined || value === null) continue;

			// Type validation
			const typeViolation = this.validateFieldType(field, value);
			if (typeViolation) {
				violations.push(typeViolation);
				continue;
			}

			// Validation rules
			const validationViolations = this.validateRules(field, value);
			violations.push(...validationViolations);

			// State machine transitions
			if (field.constraints?.transitions && isUpdate && existingValue !== undefined) {
				const transitions = field.constraints.transitions as Record<string, string[]>;
				const currentState = String(existingValue);
				const newState = String(value);

				if (currentState !== newState) {
					const allowedTransitions = transitions[currentState];
					if (allowedTransitions && !allowedTransitions.includes(newState)) {
						violations.push({
							field: field.slug,
							code: 'INVALID_STATE_TRANSITION',
							message: `Cannot transition '${field.name}' from '${currentState}' to '${newState}'. Allowed: ${allowedTransitions.join(', ')}`,
						});
					}
				}
			}

			// Select/multi-select option validation
			if ((field.fieldType === 'select' || field.fieldType === 'multi_select') && field.options) {
				const options = field.options as Array<Record<string, unknown>>;
				const validValues = options.map((o) => o.value ?? o.label);

				if (field.fieldType === 'select') {
					if (!validValues.includes(value)) {
						violations.push({
							field: field.slug,
							code: 'INVALID_OPTION',
							message: `Invalid option '${value}' for '${field.name}'. Valid: ${validValues.join(', ')}`,
						});
					}
				} else if (Array.isArray(value)) {
					for (const v of value) {
						if (!validValues.includes(v)) {
							violations.push({
								field: field.slug,
								code: 'INVALID_OPTION',
								message: `Invalid option '${v}' for '${field.name}'`,
							});
						}
					}
				}
			}
		}

		return violations;
	}

	private validateFieldType(field: SchemaField, value: unknown): ConstraintViolation | null {
		switch (field.fieldType) {
			case 'number':
			case 'currency':
				if (typeof value !== 'number') {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be a number`,
					};
				}
				break;
			case 'boolean':
				if (typeof value !== 'boolean') {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be a boolean`,
					};
				}
				break;
			case 'email':
				if (typeof value !== 'string' || !value.includes('@')) {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be a valid email`,
					};
				}
				break;
			case 'url':
				if (typeof value !== 'string') {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be a valid URL`,
					};
				}
				try {
					new URL(value);
				} catch {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be a valid URL`,
					};
				}
				break;
			case 'date':
			case 'datetime':
				if (typeof value === 'string') {
					const d = new Date(value);
					if (Number.isNaN(d.getTime())) {
						return {
							field: field.slug,
							code: 'INVALID_FIELD_TYPE',
							message: `'${field.name}' must be a valid date`,
						};
					}
				}
				break;
			case 'multi_select':
				if (!Array.isArray(value)) {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be an array`,
					};
				}
				break;
			case 'user':
				if (
					typeof value !== 'string' ||
					!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
				) {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be a valid UUID`,
					};
				}
				break;
			case 'json':
				if (typeof value === 'string') {
					try {
						JSON.parse(value);
					} catch {
						return {
							field: field.slug,
							code: 'INVALID_FIELD_TYPE',
							message: `'${field.name}' must be valid JSON`,
						};
					}
				} else if (typeof value !== 'object') {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be a JSON object or valid JSON string`,
					};
				}
				break;
			case 'attachment': {
				if (typeof value !== 'object' || value === null || Array.isArray(value)) {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must be an attachment object`,
					};
				}
				const att = value as Record<string, unknown>;
				if (!att.fileId || !att.fileName || !att.mimeType) {
					return {
						field: field.slug,
						code: 'INVALID_FIELD_TYPE',
						message: `'${field.name}' must have fileId, fileName, and mimeType`,
					};
				}
				break;
			}
			case 'rollup':
			case 'formula':
				// Computed fields — skip validation
				break;
		}
		return null;
	}

	private compileValidationPattern(pattern: string): RegExp {
		const normalized = pattern.trim().toLowerCase();
		if (normalized === 'email') {
			// Keep this intentionally simple while still requiring local-part@domain.tld shape.
			return /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		}
		return new RegExp(pattern);
	}

	private validateRules(field: SchemaField, value: unknown): ConstraintViolation[] {
		const violations: ConstraintViolation[] = [];
		const validation = field.validation as Record<string, unknown> | null;
		if (!validation) return violations;

		if (typeof value === 'number') {
			if (validation.min !== undefined && value < (validation.min as number)) {
				violations.push({
					field: field.slug,
					code: 'VALIDATION_ERROR',
					message: `'${field.name}' must be at least ${validation.min}`,
				});
			}
			if (validation.max !== undefined && value > (validation.max as number)) {
				violations.push({
					field: field.slug,
					code: 'VALIDATION_ERROR',
					message: `'${field.name}' must be at most ${validation.max}`,
				});
			}
		}

		if (typeof value === 'string') {
			if (validation.min !== undefined && value.length < (validation.min as number)) {
				violations.push({
					field: field.slug,
					code: 'VALIDATION_ERROR',
					message: `'${field.name}' must be at least ${validation.min} characters`,
				});
			}
			if (validation.max !== undefined && value.length > (validation.max as number)) {
				violations.push({
					field: field.slug,
					code: 'VALIDATION_ERROR',
					message: `'${field.name}' must be at most ${validation.max} characters`,
				});
			}
			if (validation.pattern) {
				let regex: RegExp;
				try {
					regex = this.compileValidationPattern(String(validation.pattern));
				} catch {
					violations.push({
						field: field.slug,
						code: 'VALIDATION_ERROR',
						message: `'${field.name}' has invalid validation pattern`,
					});
					return violations;
				}
				if (!regex.test(value)) {
					violations.push({
						field: field.slug,
						code: 'VALIDATION_ERROR',
						message: `'${field.name}' does not match required pattern`,
					});
				}
			}
		}

		return violations;
	}
}
