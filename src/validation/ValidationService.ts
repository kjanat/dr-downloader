/** ValidationService - Mirrors Blackmagic Design website validation patterns
 *
 * Extracted from their Angular `bmdEmailValidator` and `bmdPhoneValidator` directives
 */

export interface ValidationResult {
	isValid: boolean;
	error?: string;
}

export interface ValidationErrors {
	[field: string]: string;
}

export type RegistrationValidationData = Partial<{
	firstname: string;
	lastname: string;
	email: string;
	phone?: string;
	country: string;
	state?: string;
	city: string;
	street: string;
	zipcode: string;
	company?: string;
}>;

// NOTE: EMAIL_PATTERN and PHONE_PATTERN below are mirrored in
// `schema/config.schema.json` (email/phone `pattern`s) so editors validate
// config files the same way. Keep the two in sync when either changes.

/** Exact email regex pattern from BMD's `bmdEmailValidator` directive */
export const EMAIL_PATTERN =
	/^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([A-Za-z0-9-]+\.)+[A-Za-z0-9-]{2,}))$/;

/** Exact phone regex pattern from BMD's `bmdPhoneValidator` directive */
export const PHONE_PATTERN = /^[\s\d()+-]+$/;

/** Validates email using BMD's exact pattern:
 * ```js
 * i.$validators.email = function(t) {
 *     return i.$isEmpty(t) || e.test(t)
 * }
 * ```
 */
export function validateEmail(email: string): ValidationResult {
	// BMD allows empty emails (optional field)
	if (isEmpty(email)) {
		return { isValid: true };
	}

	const isValid = EMAIL_PATTERN.test(email);
	return {
		isValid,
		error: isValid ? undefined : 'Please enter a valid email address',
	};
}

/** Validates phone using BMD's exact pattern:
 * ```js
 * i.$validators.tel = function(t) {
 *     return i.$isEmpty(t) || e.test(t)
 * }
 * ````
 */
export function validatePhone(phone: string): ValidationResult {
	// BMD allows empty phone (optional field)
	if (isEmpty(phone)) {
		return { isValid: true };
	}

	const isValid = PHONE_PATTERN.test(phone);
	return {
		isValid,
		error: isValid
			? undefined
			: 'Phone number can only contain numbers, spaces, parentheses, plus and minus signs',
	};
}

/** Validates required fields (non-empty strings)
 *
 * Mirrors BMD's required field behavior
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
	const isValid = !isEmpty(value);
	return {
		isValid,
		error: isValid ? undefined : `${fieldName} is required`,
	};
}

/** Validates zipcode (basic format check)
 *
 * BMD appears to accept various formats based on country
 */
export function validateZipcode(zipcode: string): ValidationResult {
	if (isEmpty(zipcode)) {
		return { isValid: false, error: 'Zipcode is required' };
	}

	// Allow alphanumeric with spaces and dashes (covers US, CA, UK, etc.)
	const isValid = /^[A-Za-z0-9\s-]+$/.test(zipcode.trim());
	return {
		isValid,
		error: isValid ? undefined : 'Please enter a valid postal/zip code',
	};
}

/** Validates country selection */
export function validateCountry(country: string): ValidationResult {
	if (isEmpty(country)) {
		return { isValid: false, error: 'Country is required' };
	}

	// Remove any "string:" prefix from select values
	const cleaned = country.replace(/^string:/i, '').trim();
	const isValid = cleaned.length >= 2;

	return {
		isValid,
		error: isValid ? undefined : 'Please select a valid country',
	};
}

/** Validates state selection (required for countries that have states) */
export function validateState(state: string, country: string): ValidationResult {
	// Only validate state for countries that require it (like US, CA)
	const requiresState = countryRequiresState(country);

	if (!requiresState) {
		return { isValid: true };
	}

	if (isEmpty(state)) {
		return { isValid: false, error: 'State/Province is required' };
	}

	return { isValid: true };
}

/** Comprehensive validation for all registration data
 *
 * Returns all validation errors found
 */
export function validateRegistrationData(
	data: RegistrationValidationData,
): { isValid: boolean; errors: ValidationErrors } {
	const errors: ValidationErrors = {};

	// Validate required fields
	validateRequiredFields(data, errors);

	// Validate optional and special fields
	validateOptionalFields(data, errors);

	// Validate context-dependent fields
	validateContextDependentFields(data, errors);

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
}

function validateRequiredFields(
	data: RegistrationValidationData,
	errors: ValidationErrors,
): void {
	const requiredFields = [
		{ key: 'firstname', name: 'First Name' },
		{ key: 'lastname', name: 'Last Name' },
		{ key: 'email', name: 'Email' },
		{ key: 'country', name: 'Country' },
		{ key: 'city', name: 'City' },
		{ key: 'street', name: 'Street Address' },
		{ key: 'zipcode', name: 'Zipcode' },
	];

	for (const field of requiredFields) {
		const value = data[field.key as keyof typeof data] as string;
		const result = validateRequired(value || '', field.name);
		if (!result.isValid && result.error) {
			errors[field.key] = result.error;
		}
	}
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validation logic
function validateOptionalFields(
	data: RegistrationValidationData,
	errors: ValidationErrors,
): void {
	// Email validation (specific pattern check if provided)
	if (data.email) {
		const emailResult = validateEmail(data.email);
		if (!emailResult.isValid && emailResult.error) {
			errors.email = emailResult.error;
		}
	}

	// Phone validation (if provided)
	if (data.phone) {
		const phoneResult = validatePhone(data.phone);
		if (!phoneResult.isValid && phoneResult.error) {
			errors.phone = phoneResult.error;
		}
	}

	// Country validation
	if (data.country) {
		const countryResult = validateCountry(data.country);
		if (!countryResult.isValid && countryResult.error) {
			errors.country = countryResult.error;
		}
	}

	// Zipcode validation
	if (data.zipcode) {
		const zipcodeResult = validateZipcode(data.zipcode);
		if (!zipcodeResult.isValid && zipcodeResult.error) {
			errors.zipcode = zipcodeResult.error;
		}
	}
}

function validateContextDependentFields(
	data: RegistrationValidationData,
	errors: ValidationErrors,
): void {
	// State validation (context-dependent on country)
	if (data.country && data.state !== undefined) {
		const stateResult = validateState(data.state, data.country);
		if (!stateResult.isValid && stateResult.error) {
			errors.state = stateResult.error;
		}
	}
}

/** Mirrors Angular's `$isEmpty()` function behavior
 *
 * Checks for `undefined`, `null`, empty string, or whitespace-only string
 */
function isEmpty(value: unknown): boolean {
	return (
		value === undefined
		|| value === null
		|| value === ''
		|| (typeof value === 'string' && value.trim() === '')
	);
}

/** Determines if a country requires state/province selection
 *
 * Based on common BMD form behavior
 */
function countryRequiresState(country: string): boolean {
	const cleaned = country.replace(/^string:/i, '').toLowerCase();
	const stateCountries = ['us', 'usa', 'united states', 'ca', 'canada'];
	return stateCountries.some((c) => cleaned.includes(c));
}
