/**
 * ValidationService - Mirrors Blackmagic Design website validation patterns
 * Extracted from their Angular bmdEmailValidator and bmdPhoneValidator directives
 */

export interface ValidationResult {
	isValid: boolean;
	error?: string;
}

export interface ValidationErrors {
	[field: string]: string;
}

// biome-ignore lint/complexity/noStaticOnlyClass: not now
export class ValidationService {
	// Exact email regex pattern from BMD's bmdEmailValidator directive
	private static readonly EMAIL_PATTERN =
		/^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([A-Za-z0-9-]+\.)+[A-Za-z0-9-]{2,}))$/;

	// Exact phone regex pattern from BMD's bmdPhoneValidator directive
	private static readonly PHONE_PATTERN = /^[\s\d()+-]+$/;

	/**
	 * Validates email using BMD's exact pattern
	 * Mirrors: i.$validators.email = function(t) { return i.$isEmpty(t) || e.test(t) }
	 */
	static validateEmail(email: string): ValidationResult {
		// BMD allows empty emails (optional field)
		if (ValidationService.isEmpty(email)) {
			return { isValid: true };
		}

		const isValid = ValidationService.EMAIL_PATTERN.test(email);
		return {
			isValid,
			error: isValid ? undefined : 'Please enter a valid email address',
		};
	}

	/**
	 * Validates phone using BMD's exact pattern
	 * Mirrors: i.$validators.tel = function(t) { return i.$isEmpty(t) || e.test(t) }
	 */
	static validatePhone(phone: string): ValidationResult {
		// BMD allows empty phone (optional field)
		if (ValidationService.isEmpty(phone)) {
			return { isValid: true };
		}

		const isValid = ValidationService.PHONE_PATTERN.test(phone);
		return {
			isValid,
			error: isValid
				? undefined
				: 'Phone number can only contain numbers, spaces, parentheses, plus and minus signs',
		};
	}

	/**
	 * Validates required fields (non-empty strings)
	 * Mirrors BMD's required field behavior
	 */
	static validateRequired(value: string, fieldName: string): ValidationResult {
		const isValid = !ValidationService.isEmpty(value);
		return {
			isValid,
			error: isValid ? undefined : `${fieldName} is required`,
		};
	}

	/**
	 * Validates zipcode (basic format check)
	 * BMD appears to accept various formats based on country
	 */
	static validateZipcode(zipcode: string): ValidationResult {
		if (ValidationService.isEmpty(zipcode)) {
			return { isValid: false, error: 'Zipcode is required' };
		}

		// Allow alphanumeric with spaces and dashes (covers US, CA, UK, etc.)
		const isValid = /^[A-Za-z0-9\s-]+$/.test(zipcode.trim());
		return {
			isValid,
			error: isValid ? undefined : 'Please enter a valid postal/zip code',
		};
	}

	/**
	 * Validates country selection
	 */
	static validateCountry(country: string): ValidationResult {
		if (ValidationService.isEmpty(country)) {
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

	/**
	 * Validates state selection (required for countries that have states)
	 */
	static validateState(state: string, country: string): ValidationResult {
		// Only validate state for countries that require it (like US, CA)
		const requiresState = ValidationService.countryRequiresState(country);

		if (!requiresState) {
			return { isValid: true };
		}

		if (ValidationService.isEmpty(state)) {
			return { isValid: false, error: 'State/Province is required' };
		}

		return { isValid: true };
	}

	/**
	 * Comprehensive validation for all registration data
	 * Returns all validation errors found
	 */
	static validateRegistrationData(
		data: Partial<{
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
		}>,
	): { isValid: boolean; errors: ValidationErrors } {
		const errors: ValidationErrors = {};

		// Validate required fields
		ValidationService.validateRequiredFields(data, errors);

		// Validate optional and special fields
		ValidationService.validateOptionalFields(data, errors);

		// Validate context-dependent fields
		ValidationService.validateContextDependentFields(data, errors);

		return {
			isValid: Object.keys(errors).length === 0,
			errors,
		};
	}

	private static validateRequiredFields(
		data: Partial<{
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
		}>,
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
			const result = ValidationService.validateRequired(
				value || '',
				field.name,
			);
			if (!result.isValid && result.error) {
				errors[field.key] = result.error;
			}
		}
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validation logic
	private static validateOptionalFields(
		data: Partial<{
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
		}>,
		errors: ValidationErrors,
	): void {
		// Email validation (specific pattern check if provided)
		if (data.email) {
			const emailResult = ValidationService.validateEmail(data.email);
			if (!emailResult.isValid && emailResult.error) {
				errors.email = emailResult.error;
			}
		}

		// Phone validation (if provided)
		if (data.phone) {
			const phoneResult = ValidationService.validatePhone(data.phone);
			if (!phoneResult.isValid && phoneResult.error) {
				errors.phone = phoneResult.error;
			}
		}

		// Country validation
		if (data.country) {
			const countryResult = ValidationService.validateCountry(data.country);
			if (!countryResult.isValid && countryResult.error) {
				errors.country = countryResult.error;
			}
		}

		// Zipcode validation
		if (data.zipcode) {
			const zipcodeResult = ValidationService.validateZipcode(data.zipcode);
			if (!zipcodeResult.isValid && zipcodeResult.error) {
				errors.zipcode = zipcodeResult.error;
			}
		}
	}

	private static validateContextDependentFields(
		data: Partial<{
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
		}>,
		errors: ValidationErrors,
	): void {
		// State validation (context-dependent on country)
		if (data.country && data.state !== undefined) {
			const stateResult = ValidationService.validateState(
				data.state,
				data.country,
			);
			if (!stateResult.isValid && stateResult.error) {
				errors.state = stateResult.error;
			}
		}
	}

	/**
	 * Mirrors Angular's $isEmpty() function behavior
	 * Checks for undefined, null, empty string, or whitespace-only string
	 */
	private static isEmpty(value: unknown): boolean {
		return (
			value === undefined
			|| value === null
			|| value === ''
			|| (typeof value === 'string' && value.trim() === '')
		);
	}

	/**
	 * Determines if a country requires state/province selection
	 * Based on common BMD form behavior
	 */
	private static countryRequiresState(country: string): boolean {
		const cleaned = country.replace(/^string:/i, '').toLowerCase();
		const stateCountries = ['us', 'usa', 'united states', 'ca', 'canada'];
		return stateCountries.some((c) => cleaned.includes(c));
	}
}
