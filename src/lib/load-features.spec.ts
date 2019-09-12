import { fromDirectory } from './load-features'
import * as path from 'path'

describe('load-features', () => {
	test('should support dependencies', async () => {
		const features = await fromDirectory(
			path.join(process.cwd(), 'test', 'required-order'),
		)
		const fnames = features.map(({ name }) => name)
		expect(fnames.indexOf('First')).toBeLessThan(fnames.indexOf('Second'))
	})
	test('should support @Last', async () => {
		const features = await fromDirectory(
			path.join(process.cwd(), 'test', 'required-order'),
		)
		expect(features.map(({ name }) => name).pop()).toEqual('Last')
	})
})
