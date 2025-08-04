const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupSearchTables() {
  console.log('🚀 Setting up search tables...')

  try {
    // Create user_search_history table
    console.log('📝 Creating user_search_history table...')
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_search_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          search_query TEXT NOT NULL,
          search_category TEXT,
          results_count INTEGER DEFAULT 0,
          clicked_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
          search_source TEXT DEFAULT 'header',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_user_search_history_user_id ON user_search_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_search_history_created_at ON user_search_history(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_user_search_history_user_recent ON user_search_history(user_id, created_at DESC);

        -- Enable RLS
        ALTER TABLE user_search_history ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        DROP POLICY IF EXISTS "Users can view their own search history" ON user_search_history;
        CREATE POLICY "Users can view their own search history" ON user_search_history
          FOR SELECT USING (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can insert their own search history" ON user_search_history;
        CREATE POLICY "Users can insert their own search history" ON user_search_history
          FOR INSERT WITH CHECK (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can delete their own search history" ON user_search_history;
        CREATE POLICY "Users can delete their own search history" ON user_search_history
          FOR DELETE USING (auth.uid() = user_id);
      `
    })

    if (tableError) {
      console.error('❌ Error creating user_search_history table:', tableError)
    } else {
      console.log('✅ user_search_history table created successfully')
    }

    // Create search_suggestions table
    console.log('📝 Creating search_suggestions table...')
    const { error: suggestionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS search_suggestions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          suggestion_text TEXT NOT NULL UNIQUE,
          suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('product', 'category', 'brand', 'popular')),
          product_id UUID REFERENCES products(id) ON DELETE CASCADE,
          category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
          search_count INTEGER DEFAULT 0,
          click_count INTEGER DEFAULT 0,
          priority_score DECIMAL(10,4) DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_search_suggestions_text ON search_suggestions(suggestion_text);
        CREATE INDEX IF NOT EXISTS idx_search_suggestions_type ON search_suggestions(suggestion_type);
        CREATE INDEX IF NOT EXISTS idx_search_suggestions_priority ON search_suggestions(priority_score DESC);

        -- Enable RLS
        ALTER TABLE search_suggestions ENABLE ROW LEVEL SECURITY;

        -- Create RLS policy
        DROP POLICY IF EXISTS "Anyone can view active search suggestions" ON search_suggestions;
        CREATE POLICY "Anyone can view active search suggestions" ON search_suggestions
          FOR SELECT USING (is_active = true);
      `
    })

    if (suggestionsError) {
      console.error('❌ Error creating search_suggestions table:', suggestionsError)
    } else {
      console.log('✅ search_suggestions table created successfully')
    }

    // Populate initial search suggestions
    console.log('📝 Populating initial search suggestions...')
    
    // Get popular product names
    const { data: products } = await supabase
      .from('products')
      .select('id, name_en, brand, category_id, is_featured')
      .eq('is_active', true)
      .limit(50)

    if (products && products.length > 0) {
      const suggestions = []
      
      // Add product suggestions
      products.forEach(product => {
        if (product.name_en && product.name_en.length > 2) {
          suggestions.push({
            suggestion_text: product.name_en,
            suggestion_type: 'product',
            product_id: product.id,
            priority_score: product.is_featured ? 10.0 : 5.0
          })
        }
        
        // Add brand suggestions
        if (product.brand && product.brand.length > 1) {
          suggestions.push({
            suggestion_text: product.brand,
            suggestion_type: 'brand',
            priority_score: 6.0
          })
        }
      })

      // Remove duplicates
      const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
        index === self.findIndex(s => s.suggestion_text === suggestion.suggestion_text)
      )

      // Insert suggestions in batches
      const batchSize = 100
      for (let i = 0; i < uniqueSuggestions.length; i += batchSize) {
        const batch = uniqueSuggestions.slice(i, i + batchSize)
        const { error: insertError } = await supabase
          .from('search_suggestions')
          .upsert(batch, { onConflict: 'suggestion_text' })

        if (insertError) {
          console.warn('⚠️ Error inserting suggestion batch:', insertError)
        }
      }

      console.log(`✅ Inserted ${uniqueSuggestions.length} search suggestions`)
    }

    // Get categories for suggestions
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name_en')

    if (categories && categories.length > 0) {
      const categorySuggestions = categories.map(category => ({
        suggestion_text: category.name_en,
        suggestion_type: 'category',
        category_id: category.id,
        priority_score: 8.0
      }))

      const { error: categoryError } = await supabase
        .from('search_suggestions')
        .upsert(categorySuggestions, { onConflict: 'suggestion_text' })

      if (categoryError) {
        console.warn('⚠️ Error inserting category suggestions:', categoryError)
      } else {
        console.log(`✅ Inserted ${categorySuggestions.length} category suggestions`)
      }
    }

    console.log('🎉 Search tables setup completed successfully!')

  } catch (error) {
    console.error('❌ Error setting up search tables:', error)
    process.exit(1)
  }
}

// Run the setup
setupSearchTables()
