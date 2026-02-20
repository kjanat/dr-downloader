import type { Page } from 'puppeteer';
import type { RegistrationData } from '../config/types.ts';
import { SELECTORS } from '../constants/selectors.ts';
import { type ValidationErrors, ValidationService } from '../validation/ValidationService.ts';

export class FormHandler {
	constructor(private page: Page) {}

	async fillRegistrationForm(data: RegistrationData): Promise<void> {
		// Validate data before attempting form submission
		const validationResult = this.validateRegistrationData(data);
		if (!validationResult.isValid) {
			const errorMessages = Object.entries(validationResult.errors)
				.map(([field, error]) => `${field}: ${error}`)
				.join('\n');
			throw new Error(`Registration data validation failed:\n${errorMessages}`);
		}

		await this.waitForFormLoad();

		await this.typeByLabelOrId(
			'First Name',
			SELECTORS.firstname,
			data.firstname,
		);
		await this.typeByLabelOrId('Last Name', SELECTORS.lastname, data.lastname);
		await this.typeByLabelOrId('Email', SELECTORS.email, data.email);

		if (data.phone) {
			await this.typeByLabelOrId('Phone', SELECTORS.phone, data.phone);
		}

		await this.fillAddress(data);
		await this.selectCountryAndState(data);
		// Note: No policy checkbox in current BMD form
	}

	/**
	 * Validates individual field for real-time feedback
	 * @param fieldName Name of the field to validate
	 * @param value Value to validate
	 * @param context Additional context (e.g., country for state validation)
	 * @returns Validation result
	 */
	validateField(
		fieldName: string,
		value: string,
		context?: any,
	): { isValid: boolean; error?: string } {
		switch (fieldName) {
			case 'email':
				return ValidationService.validateEmail(value);
			case 'phone':
				return ValidationService.validatePhone(value);
			case 'firstname':
			case 'lastname':
			case 'city':
			case 'street':
				return ValidationService.validateRequired(value, fieldName);
			case 'zipcode':
				return ValidationService.validateZipcode(value);
			case 'country':
				return ValidationService.validateCountry(value);
			case 'state':
				return ValidationService.validateState(value, context?.country || '');
			default:
				return { isValid: true };
		}
	}

	private async waitForFormLoad(): Promise<void> {
		await this.page.waitForSelector('form', { visible: true, timeout: 20_000 });
	}

	private async typeByLabelOrId(
		labelText: string,
		idSelector: string,
		value: string,
	): Promise<void> {
		if (!value) return;

		const ok = await this.page.evaluate(
			(label, sel, val) => {
				const findByLabel = () => {
					const labs = Array.from(document.querySelectorAll('label'));
					const match = labs.find(
						(el) =>
							(el.textContent || '').trim().toLowerCase()
								=== label.toLowerCase(),
					);
					if (!match) return null;
					const forId = match.getAttribute('for');
					if (forId) {
						return document.getElementById(forId) as HTMLInputElement | null;
					}
					return (
						(match.querySelector(
							'input,textarea',
						) as HTMLInputElement | null) || null
					);
				};

				const input = findByLabel()
					|| (document.querySelector(sel) as HTMLInputElement | null);
				if (!input) return false;

				input.focus();
				(input as HTMLInputElement).value = val;
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(new Event('change', { bubbles: true }));
				return true;
			},
			labelText,
			idSelector,
			value,
		);

		if (!ok) {
			console.warn(
				`Could not find input for "${labelText}" / ${idSelector}, continuing...`,
			);
		}
	}

	private async fillAddress(data: RegistrationData): Promise<void> {
		await this.typeByLabelOrId(
			'Company',
			SELECTORS.company,
			data.company ?? '',
		);
		await this.typeByLabelOrId('Street', SELECTORS.street, data.street);
		await this.typeByLabelOrId('City', SELECTORS.city, data.city);
		await this.typeByLabelOrId('Zip', SELECTORS.zipcode, data.zipcode);
	}

	private async selectCountryAndState(data: RegistrationData): Promise<void> {
		// BMD uses Angular's "string:" prefix for select values
		const countryValue = data.country.startsWith('string:')
			? data.country
			: `string:${data.country.toLowerCase()}`;

		await this.selectByValueOrText(
			SELECTORS.country,
			countryValue,
			this.countryTextGuess(data.country),
		);

		// Wait for state options to populate (triggered by country change)
		try {
			await this.waitForOptions(SELECTORS.state, 15_000);
		} catch {
			console.log(
				'ℹ️ No state options loaded (may not be required for this country)',
			);
			return;
		}

		if (data.state) {
			const stateValue = data.state.startsWith('string:')
				? data.state
				: `string:${data.state}`;
			await this.selectByValueOrText(SELECTORS.state, stateValue, data.state);
		}
	}

	private async selectByValueOrText(
		selector: string,
		preferredValue: string,
		fallbackText: string,
	) {
		const byValue = await this.page.evaluate(
			(sel, value) => {
				const el = document.querySelector(sel) as HTMLSelectElement | null;
				if (!el) return false;
				const opt = Array.from(el.options).find((o) => o.value === value);
				if (opt) {
					el.value = opt.value;
					el.dispatchEvent(new Event('change', { bubbles: true }));
					return true;
				}
				return false;
			},
			selector,
			preferredValue,
		);
		if (byValue) return;

		const byText = await this.page.evaluate(
			(sel, text) => {
				const el = document.querySelector(sel) as HTMLSelectElement | null;
				if (!el) return false;
				const norm = (s: string) => s.trim().toLowerCase();
				const target = norm(text);
				const opt = Array.from(el.options).find((o) => norm(o.text) === target);
				if (opt) {
					el.value = opt.value;
					el.dispatchEvent(new Event('change', { bubbles: true }));
					return true;
				}
				return false;
			},
			selector,
			fallbackText,
		);

		if (!byText) {
			console.warn(
				`Could not select ${selector} (${preferredValue} / ${fallbackText})`,
			);
		}
	}

	private async waitForOptions(selector: string, timeout = 15_000) {
		await this.page.waitForFunction(
			(sel) => {
				const el = document.querySelector(sel) as HTMLSelectElement | null;
				return !!el && el.options.length > 1;
			},
			{ timeout },
			selector,
		);
	}

	private countryTextGuess(codeOrText: string): string {
		const clean = codeOrText.replace(/^string:/i, '');
		if (clean.length === 2) {
			const map: Record<string, string> = {
				US: 'United States',
				GB: 'United Kingdom',
				NL: 'Netherlands',
				DE: 'Germany',
				FR: 'France',
				IT: 'Italy',
				ES: 'Spain',
				CA: 'Canada',
				AU: 'Australia',
			};
			return map[clean.toUpperCase()] || clean;
		}
		return clean;
	}

	/**
	 * Validates registration data using BMD's exact validation patterns
	 * @param data Registration data to validate
	 * @returns Validation result with any errors found
	 */
	private validateRegistrationData(data: RegistrationData): {
		isValid: boolean;
		errors: ValidationErrors;
	} {
		return ValidationService.validateRegistrationData(data);
	}
}
