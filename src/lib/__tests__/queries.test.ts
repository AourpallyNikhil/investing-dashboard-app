import { describe, it, expect } from 'vitest'
import { timeRanges } from '../queries'

describe('queries', () => {
  describe('timeRanges', () => {
    it('should have correct time range configurations', () => {
      expect(timeRanges).toHaveLength(7)
      
      const oneYear = timeRanges.find(r => r.value === '1Y')
      expect(oneYear).toBeDefined()
      expect(oneYear?.days).toBe(365)
      expect(oneYear?.label).toBe('1Y')
    })

    it('should have all required time ranges', () => {
      const expectedRanges = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'Max']
      const actualRanges = timeRanges.map(r => r.value)
      
      expectedRanges.forEach(range => {
        expect(actualRanges).toContain(range)
      })
    })
  })
})
