interface PasswordRule {
  label: string;
  met: boolean;
}

const MIN_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', met: password.length >= MIN_LENGTH },
    { label: 'One uppercase letter', met: UPPERCASE_REGEX.test(password) },
    { label: 'One lowercase letter', met: LOWERCASE_REGEX.test(password) },
    { label: 'One number', met: NUMBER_REGEX.test(password) },
    { label: 'One special character (!@#$%...)', met: SPECIAL_CHAR_REGEX.test(password) },
  ];
}

export function validatePassword(password: string): string[] {
  return getPasswordRules(password)
    .filter((rule) => !rule.met)
    .map((rule) => rule.label);
}
