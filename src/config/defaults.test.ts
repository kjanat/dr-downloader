import { DEFAULT_REGISTRATION, isPlaceholderRegistration } from '#config/defaults';
import { describe, expect, it } from 'bun:test';

describe('DEFAULT_REGISTRATION', () => {
	it('is obviously placeholder (reserved example.com email, fake name)', () => {
		expect(DEFAULT_REGISTRATION.email).toBe('placeholder@example.com');
		expect(DEFAULT_REGISTRATION.email.endsWith('@example.com')).toBe(true);
		expect(`${DEFAULT_REGISTRATION.firstname} ${DEFAULT_REGISTRATION.lastname}`).toBe('Placeholder User');
	});
});

describe('isPlaceholderRegistration', () => {
	it('is true for the built-in default email', () => {
		expect(isPlaceholderRegistration({ email: DEFAULT_REGISTRATION.email })).toBe(true);
	});

	it('is false once a real email is supplied', () => {
		expect(isPlaceholderRegistration({ email: 'you@example.com' })).toBe(false);
	});
});
