import { replaceStoragePlaceholders } from './replaceStoragePlaceholders'
import { StoreKeyUndefinedError } from './runner'

describe('replaceStoragePlaceholders', () => {
	it.each([
		[`{foo}`, 'bar'],
		[
			`{
      "principal": "{foo:bar}"
     }`,
			`{
      "principal": "baz"
     }`,
		],
	])('replace the placeholder in %s', (template, expected) => {
		expect(
			replaceStoragePlaceholders({
				foo: 'bar',
				'foo:bar': 'baz',
			})(template),
		).toEqual(expected)
	})
	it.each([
		`{foo}`,
		`{
      "principal": "{cognito:IdentityI}"
     }`,
		`{
      "principal": "{foo}"
     }`,
	])('should error on unreplaced placeholders in %s', (template) => {
		expect(() => replaceStoragePlaceholders({})(template)).toThrow(
			StoreKeyUndefinedError,
		)
	})
})
