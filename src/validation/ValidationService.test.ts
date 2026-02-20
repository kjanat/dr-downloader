import { describe, expect, it } from 'bun:test';
import { ValidationService } from '@/validation/ValidationService.ts';

describe('ValidationService', () => {
	describe('Email Validation', () => {
		it('should accept valid email addresses', () => {
			const validEmails = [
				'test@example.com',
				'user.name@domain.com',
				'user+tag@example.org',
				'test.email.with+symbol@example.com',
				'user@domain-name.com',
				'firstname.lastname@domain.co.uk',
				'email@123.123.123.123', // IP address format (if supported by BMD)
			];

			validEmails.forEach((email) => {
				const result = ValidationService.validateEmail(email);
				expect(result.isValid).toBe(true);
				expect(result.error).toBeUndefined();
			});
		});

		it('should reject invalid email addresses', () => {
			const invalidEmails = [
				'plainaddress',
				'@missingdomain.com',
				'missing@.com',
				'missing@domain',
				'spaces in@domain.com',
				'email@domain..com',
				'email@.domain.com',
				'email@domain.com.',
				'email@domain,com',
				'email@domain@domain.com',
				'email..email@domain.com',
				'.email@domain.com',
				'email.@domain.com',
			];

			invalidEmails.forEach((email) => {
				const result = ValidationService.validateEmail(email);
				expect(result.isValid).toBe(false);
				expect(result.error).toBe('Please enter a valid email address');
			});
		});

		it('should accept empty email (BMD allows optional)', () => {
			const result = ValidationService.validateEmail('');
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should accept whitespace-only email as empty', () => {
			const result = ValidationService.validateEmail('   ');
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe('Phone Validation', () => {
		it('should accept valid phone numbers', () => {
			// Only test numbers that match BMD's exact pattern: [\s\d()+-]+
			const validPhones = [
				'555-123-4567',
				'(555) 123-4567',
				'+1-555-123-4567',
				'555 123 4567',
				'5551234567',
				'+1 (555) 123-4567',
				'+44 20 7946 0958',
				'(+1) 555 123 4567',
			];

			validPhones.forEach((phone) => {
				const result = ValidationService.validatePhone(phone);
				expect(result.isValid).toBe(true);
				expect(result.error).toBeUndefined();
			});
		});

		it('should reject invalid phone numbers', () => {
			const invalidPhones = [
				'555.123.4567', // Dots not allowed in BMD pattern
				'555/123/4567', // Slashes not allowed
				'555_123_4567', // Underscores not allowed
				'abc-def-ghij', // Letters not allowed
				'555-123-456x', // Letters not allowed
				'555@123.com', // Special chars not allowed
				'555#123*4567', // Special chars not allowed
			];

			invalidPhones.forEach((phone) => {
				const result = ValidationService.validatePhone(phone);
				expect(result.isValid).toBe(false);
				expect(result.error).toBe(
					'Phone number can only contain numbers, spaces, parentheses, plus and minus signs',
				);
			});
		});

		it('should accept empty phone (BMD allows optional)', () => {
			const result = ValidationService.validatePhone('');
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe('Required Field Validation', () => {
		it('should require non-empty values', () => {
			const result = ValidationService.validateRequired('John', 'First Name');
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject empty values', () => {
			const result = ValidationService.validateRequired('', 'First Name');
			expect(result.isValid).toBe(false);
			expect(result.error).toBe('First Name is required');
		});

		it('should reject whitespace-only values', () => {
			const result = ValidationService.validateRequired('   ', 'Last Name');
			expect(result.isValid).toBe(false);
			expect(result.error).toBe('Last Name is required');
		});
	});

	describe('Zipcode Validation', () => {
		it('should accept valid zipcodes', () => {
			const validZipcodes = [
				'10001', // US 5-digit
				'10001-1234', // US 9-digit
				'K1A 0A6', // Canadian
				'SW1A 1AA', // UK
				'12345', // Generic 5-digit
				'ABC 123', // Alphanumeric with space
			];

			validZipcodes.forEach((zipcode) => {
				const result = ValidationService.validateZipcode(zipcode);
				expect(result.isValid).toBe(true);
				expect(result.error).toBeUndefined();
			});
		});

		it('should reject invalid zipcodes', () => {
			const invalidZipcodes = [
				'', // Empty
				'   ', // Whitespace only
				'12345@', // Special characters
				'ABC#123', // Invalid special characters
				'12345/67890', // Invalid separator
			];

			invalidZipcodes.forEach((zipcode) => {
				const result = ValidationService.validateZipcode(zipcode);
				expect(result.isValid).toBe(false);
				expect(result.error).toBe(
					zipcode.trim() === ''
						? 'Zipcode is required'
						: 'Please enter a valid postal/zip code',
				);
			});
		});
	});

	describe('Country Validation', () => {
		it('should accept valid countries', () => {
			const validCountries = [
				'US',
				'United States',
				'string:US', // BMD form value format
				'string:Canada',
				'GB',
				'United Kingdom',
			];

			validCountries.forEach((country) => {
				const result = ValidationService.validateCountry(country);
				expect(result.isValid).toBe(true);
				expect(result.error).toBeUndefined();
			});
		});

		it('should reject invalid countries', () => {
			const result = ValidationService.validateCountry('');
			expect(result.isValid).toBe(false);
			expect(result.error).toBe('Country is required');
		});
	});

	describe('State Validation', () => {
		it('should require state for US', () => {
			const result = ValidationService.validateState('', 'US');
			expect(result.isValid).toBe(false);
			expect(result.error).toBe('State/Province is required');
		});

		it('should accept state for US', () => {
			const result = ValidationService.validateState('New York', 'US');
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should not require state for non-state countries', () => {
			const result = ValidationService.validateState('', 'UK');
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should handle string: prefix in country', () => {
			const result = ValidationService.validateState('', 'string:US');
			expect(result.isValid).toBe(false);
			expect(result.error).toBe('State/Province is required');
		});
	});

	describe('Complete Registration Data Validation', () => {
		it('should validate complete valid data', () => {
			const validData = {
				firstname: 'John',
				lastname: 'Doe',
				email: 'john.doe@example.com',
				phone: '555-123-4567',
				country: 'US',
				state: 'New York',
				city: 'New York',
				street: '123 Main St',
				zipcode: '10001',
				company: 'Test Company',
			};

			const result = ValidationService.validateRegistrationData(validData);
			expect(result.isValid).toBe(true);
			expect(Object.keys(result.errors)).toHaveLength(0);
		});

		it('should handle optional fields correctly', () => {
			const dataWithOptionalFields = {
				firstname: 'John',
				lastname: 'Doe',
				email: 'john.doe@example.com',
				// phone omitted (optional)
				country: 'UK',
				// state omitted (not required for UK)
				city: 'London',
				street: '123 High Street',
				zipcode: 'SW1A 1AA',
				// company omitted (optional)
			};

			const result = ValidationService.validateRegistrationData(
				dataWithOptionalFields,
			);
			expect(result.isValid).toBe(true);
			expect(Object.keys(result.errors)).toHaveLength(0);
		});

		it('should collect all validation errors', () => {
			const invalidData = {
				firstname: '',
				lastname: '',
				email: 'invalid-email',
				phone: 'invalid@phone',
				country: '',
				state: '',
				city: '',
				street: '',
				zipcode: '',
			};

			const result = ValidationService.validateRegistrationData(invalidData);
			expect(result.isValid).toBe(false);

			// Check that multiple errors are collected
			expect(result.errors.firstname).toBe('First Name is required');
			expect(result.errors.lastname).toBe('Last Name is required');
			expect(result.errors.email).toBe('Please enter a valid email address');
			expect(result.errors.phone).toBe(
				'Phone number can only contain numbers, spaces, parentheses, plus and minus signs',
			);
			expect(result.errors.country).toBe('Country is required');
			expect(result.errors.city).toBe('City is required');
			expect(result.errors.street).toBe('Street Address is required');
			expect(result.errors.zipcode).toBe('Zipcode is required');
		});

		it('should handle US state requirement correctly', () => {
			const usDataNoState = {
				firstname: 'John',
				lastname: 'Doe',
				email: 'john.doe@example.com',
				country: 'US',
				state: '', // Required for US
				city: 'New York',
				street: '123 Main St',
				zipcode: '10001',
			};

			const result = ValidationService.validateRegistrationData(usDataNoState);
			expect(result.isValid).toBe(false);
			expect(result.errors.state).toBe('State/Province is required');
		});

		it('should handle BMD form value format', () => {
			const bmdFormatData = {
				firstname: 'John',
				lastname: 'Doe',
				email: 'john.doe@example.com',
				country: 'string:US', // BMD select value format
				state: 'string:New York',
				city: 'New York',
				street: '123 Main St',
				zipcode: '10001',
			};

			const result = ValidationService.validateRegistrationData(bmdFormatData);
			expect(result.isValid).toBe(true);
			expect(Object.keys(result.errors)).toHaveLength(0);
		});
	});

	describe('Edge Cases', () => {
		it('should handle null and undefined values', () => {
			const result = ValidationService.validateRegistrationData({
				firstname: undefined as any,
				lastname: null as any,
				email: undefined as any,
				country: null as any,
				city: undefined as any,
				street: null as any,
				zipcode: undefined as any,
			});

			expect(result.isValid).toBe(false);
			// Should treat null/undefined as empty and require them
			expect(result.errors.firstname).toBe('First Name is required');
			expect(result.errors.lastname).toBe('Last Name is required');
		});

		it('should handle very long email addresses', () => {
			const longEmail = `${'a'.repeat(64)}@${'b'.repeat(63)}.com`;
			const result = ValidationService.validateEmail(longEmail);
			// Should validate based on pattern, not length
			expect(result.isValid).toBe(true);
		});

		it('should handle international phone formats', () => {
			const intlPhones = [
				'+44 20 7946 0958', // UK
				'+33 1 42 68 53 00', // France
				'+49 30 12345678', // Germany
			];

			intlPhones.forEach((phone) => {
				const result = ValidationService.validatePhone(phone);
				expect(result.isValid).toBe(true);
			});
		});
	});
});
