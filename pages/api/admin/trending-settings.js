import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { method } = req;

  try {
    // Basic admin authentication check
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    switch (method) {
      case 'GET':
        return await getTrendingSettings(req, res);
      case 'PUT':
        return await updateTrendingSettings(req, res);
      default:
        res.setHeader('Allow', ['GET', 'PUT']);
        return res.status(405).json({ error: `Method ${method} Not Allowed` });
    }
  } catch (error) {
    console.error('Trending settings API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function getTrendingSettings(req, res) {
  try {
    const { data: settings, error } = await supabase
      .from('trending_system_settings')
      .select('*')
      .order('setting_key');

    if (error) {
      console.error('Error fetching trending settings:', error);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }

    // Convert to a more usable format
    const settingsMap = {};
    settings?.forEach(setting => {
      settingsMap[setting.setting_key] = {
        value: setting.setting_value,
        description: setting.description,
        updated_at: setting.updated_at
      };
    });

    return res.status(200).json({
      success: true,
      settings: settingsMap,
      raw_settings: settings
    });

  } catch (error) {
    console.error('Error in getTrendingSettings:', error);
    return res.status(500).json({ error: 'Failed to get trending settings' });
  }
}

async function updateTrendingSettings(req, res) {
  try {
    const { settings, user_id } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const validSettings = [
      'algorithm_enabled',
      'refresh_frequency_hours',
      'top_selling_count',
      'recently_added_count',
      'random_stock_count',
      'min_sales_for_trending',
      'days_for_recent_products'
    ];

    const updates = [];
    const errors = [];

    for (const [key, value] of Object.entries(settings)) {
      if (!validSettings.includes(key)) {
        errors.push(`Invalid setting key: ${key}`);
        continue;
      }

      // Validate setting values
      if (key === 'algorithm_enabled') {
        if (typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`);
          continue;
        }
      } else {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 0) {
          errors.push(`${key} must be a positive number`);
          continue;
        }
        if (key.includes('count') && numValue > 10) {
          errors.push(`${key} cannot exceed 10`);
          continue;
        }
      }

      updates.push({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString(),
        updated_by: user_id
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation errors',
        details: errors 
      });
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid settings to update' });
    }

    // Update settings one by one
    const results = [];
    for (const update of updates) {
      const { data, error } = await supabase
        .from('trending_system_settings')
        .update({
          setting_value: update.setting_value,
          updated_at: update.updated_at,
          updated_by: update.updated_by
        })
        .eq('setting_key', update.setting_key)
        .select()
        .single();

      if (error) {
        console.error(`Error updating setting ${update.setting_key}:`, error);
        errors.push(`Failed to update ${update.setting_key}`);
      } else {
        results.push(data);
      }
    }

    if (errors.length > 0) {
      return res.status(500).json({ 
        error: 'Some settings failed to update',
        details: errors,
        updated: results
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      updated_settings: results
    });

  } catch (error) {
    console.error('Error in updateTrendingSettings:', error);
    return res.status(500).json({ error: 'Failed to update trending settings' });
  }
}
