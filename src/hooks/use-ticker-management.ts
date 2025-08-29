// Hook for managing tickers (add/delete) in the database
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queries'

export interface AddTickerData {
  ticker: string
  name: string
  sector?: string
  industry?: string
  exchange?: string
}

export function useTickerManagement() {
  const [isAdding, setIsAdding] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const queryClient = useQueryClient()

  const addTicker = async (tickerData: AddTickerData) => {
    setIsAdding(true)
    setError(null)

    try {
      console.log('🔄 Adding ticker:', tickerData.ticker)

      // Check if ticker already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('ticker', tickerData.ticker.toUpperCase())
        .single()

      if (existingCompany) {
        // Company exists, check if it's in the default watchlist
        const { data: defaultWatchlist } = await supabase
          .from('watchlists')
          .select('id')
          .eq('is_default', true)
          .single()

        if (defaultWatchlist) {
          // Check if already in watchlist
          const { data: existingWatchlistItem } = await supabase
            .from('watchlist_items')
            .select('id')
            .eq('watchlist_id', defaultWatchlist.id)
            .eq('company_id', existingCompany.id)
            .single()

          if (existingWatchlistItem) {
            throw new Error(`Ticker ${tickerData.ticker} is already in your watchlist`)
          } else {
            // Add to watchlist
            const { error: watchlistError } = await supabase
              .from('watchlist_items')
              .insert({
                watchlist_id: defaultWatchlist.id,
                company_id: existingCompany.id
              })

            if (watchlistError) {
              throw new Error(`Failed to add ${tickerData.ticker} to watchlist: ${watchlistError.message}`)
            }

            // Refresh queries and return success
            console.log('🔄 Invalidating all company and screener queries after add to watchlist...')
            await queryClient.invalidateQueries({ queryKey: queryKeys.companies })
            await queryClient.invalidateQueries({ queryKey: ['screener'] })
            await queryClient.removeQueries({ queryKey: ['screener'] })
            await queryClient.removeQueries({ queryKey: queryKeys.companies })
            await queryClient.refetchQueries({ queryKey: queryKeys.companies })
            await queryClient.refetchQueries({ queryKey: ['screener'] })

            console.log('✅ Successfully added existing ticker to watchlist:', tickerData.ticker)
            return existingCompany
          }
        } else {
          throw new Error(`Ticker ${tickerData.ticker} already exists but no default watchlist found`)
        }
      }

      // Add company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          ticker: tickerData.ticker.toUpperCase(),
          name: tickerData.name,
          sector: tickerData.sector || 'Unknown',
          industry: tickerData.industry || 'Unknown',
          exchange: tickerData.exchange || 'NASDAQ',
          currency: 'USD',
          country: 'US'
        })
        .select('id')
        .single()

      if (companyError || !newCompany) {
        throw new Error(`Failed to add company: ${companyError?.message}`)
      }

      // Add primary security
      const { error: securityError } = await supabase
        .from('securities')
        .insert({
          company_id: newCompany.id,
          symbol: tickerData.ticker.toUpperCase(),
          type: 'stock',
          is_primary: true
        })

      if (securityError) {
        throw new Error(`Failed to add security: ${securityError.message}`)
      }

      // Add to default watchlist
      const { data: defaultWatchlist } = await supabase
        .from('watchlists')
        .select('id')
        .eq('is_default', true)
        .single()

      if (defaultWatchlist) {
        const { error: watchlistError } = await supabase
          .from('watchlist_items')
          .insert({
            watchlist_id: defaultWatchlist.id,
            company_id: newCompany.id
          })

        if (watchlistError) {
          console.warn('⚠️ Failed to add to watchlist:', watchlistError.message)
          // Don't throw error - company was created successfully
        }
      }

      // Force refresh all queries immediately
      console.log('🔄 Invalidating all company and screener queries after add...')
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies })
      await queryClient.invalidateQueries({ queryKey: ['screener'] }) // Invalidate ALL screener queries
      
      // Clear the cache completely to force fresh data
      await queryClient.removeQueries({ queryKey: ['screener'] })
      await queryClient.removeQueries({ queryKey: queryKeys.companies })
      
      // Force refetch immediately to update UI
      await queryClient.refetchQueries({ queryKey: queryKeys.companies })
      await queryClient.refetchQueries({ queryKey: ['screener'] })

      console.log('✅ Successfully added ticker:', tickerData.ticker)
      return newCompany

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add ticker'
      setError(errorMessage)
      console.error('❌ Failed to add ticker:', errorMessage)
      throw err
    } finally {
      setIsAdding(false)
    }
  }

  const deleteTicker = async (ticker: string) => {
    setIsDeleting(ticker)
    setError(null)

    try {
      console.log('🔄 Deleting ticker:', ticker)

      // Get company ID
      const { data: company, error: findError } = await supabase
        .from('companies')
        .select('id, ticker')
        .eq('ticker', ticker.toUpperCase())
        .single()

      if (findError) {
        console.log('🔍 Database error:', findError)
        
        // If ticker not found, it might already be deleted - refresh the UI
        if (findError.code === 'PGRST116') {
          console.log('⚠️ Ticker already deleted or not found, force refreshing UI...')
          await queryClient.invalidateQueries({ queryKey: queryKeys.companies })
          await queryClient.invalidateQueries({ queryKey: ['screener'] }) // Invalidate ALL screener queries
          
          // Force immediate refetch to sync UI with database
          await queryClient.refetchQueries({ queryKey: queryKeys.companies })
          await queryClient.refetchQueries({ queryKey: ['screener'] }) // Refetch ALL screener queries
          return // Exit successfully since the ticker is already gone
        }
        
        throw new Error(`Database error: ${findError.message}`)
      }

      if (!company) {
        console.log('⚠️ Ticker not found in database, force refreshing UI...')
        // Refresh UI to sync with database state
        await queryClient.invalidateQueries({ queryKey: queryKeys.companies })
        await queryClient.invalidateQueries({ queryKey: ['screener'] }) // Invalidate ALL screener queries
        
        // Force immediate refetch to sync UI with database
        await queryClient.refetchQueries({ queryKey: queryKeys.companies })
        await queryClient.refetchQueries({ queryKey: ['screener'] }) // Refetch ALL screener queries
        return // Exit successfully since the ticker doesn't exist
      }

      console.log('🗑️ Found company to delete:', company)

      // Delete company (cascade will handle securities, prices, etc.)
      const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id)

      if (deleteError) {
        throw new Error(`Failed to delete ticker: ${deleteError.message}`)
      }

      // Force refresh all queries immediately
      console.log('🔄 Invalidating all company and screener queries...')
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies })
      await queryClient.invalidateQueries({ queryKey: ['screener'] }) // Invalidate ALL screener queries regardless of filters
      
      // Clear the cache completely to force fresh data
      await queryClient.removeQueries({ queryKey: ['screener'] })
      await queryClient.removeQueries({ queryKey: queryKeys.companies })
      
      // Force refetch immediately to update UI
      console.log('🔄 Refetching all company and screener queries...')
      await queryClient.refetchQueries({ queryKey: queryKeys.companies })
      await queryClient.refetchQueries({ queryKey: ['screener'] }) // Refetch ALL screener queries
      
      // Small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 100))

      console.log('✅ Successfully deleted ticker:', ticker)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete ticker'
      setError(errorMessage)
      console.error('❌ Failed to delete ticker:', errorMessage)
      throw err
    } finally {
      setIsDeleting(null)
    }
  }

  return {
    addTicker,
    deleteTicker,
    isAdding,
    isDeleting,
    error,
    clearError: () => setError(null)
  }
}
