'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Send, Shield, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const BOT_USERNAME = 'Authenticationfypbot';

export default function TelegramLoginUrl() {
  const [loginUrl, setLoginUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we're returning from Telegram auth
    checkAuthReturn();
  }, [searchParams]);

  useEffect(() => {
    // Generate login URL on mount
    generateLoginUrl();
  }, []);

  const checkAuthReturn = async () => {
    // Telegram returns data as query parameters
    const id = searchParams.get('id');
    const first_name = searchParams.get('first_name');
    const username = searchParams.get('username');
    const photo_url = searchParams.get('photo_url');
    const auth_date = searchParams.get('auth_date');
    const hash = searchParams.get('hash');

    if (id && hash) {
      console.log('✅ Telegram auth data detected!');
      
      // Clean URL
      const newUrl = new URL(window.location.href);
      ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash'].forEach(param => {
        newUrl.searchParams.delete(param);
      });
      window.history.replaceState({}, '', newUrl);

      // Process authentication
      try {
        const authData = {
          id,
          first_name: first_name || '',
          last_name: searchParams.get('last_name') || undefined,
          username: username || undefined,
          photo_url: photo_url || undefined,
          auth_date: auth_date || '',
          hash: hash || ''
        };

        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(authData),
          credentials: 'include'
        });

        const result = await response.json();

        if (response.ok) {
          console.log('✅ Authentication successful!');
          toast.success('Successfully signed in with Telegram!');
          
          if (result.requiresSetup) {
            router.push('/en/auth/telegram-setup');
          } else if (result.redirect_url) {
            window.location.href = result.redirect_url;
          } else {
            router.refresh();
            router.push('/en');
          }
        } else {
          throw new Error(result.error || 'Authentication failed');
        }
      } catch (err) {
        console.error('❌ Auth error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        toast.error(`Telegram login failed: ${errorMessage}`);
      }
    }
  };

  const generateLoginUrl = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // Generate the login URL on the server
      const response = await fetch('/api/auth/telegram/generate-login-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate login URL');
      }

      setLoginUrl(data.loginUrl);
    } catch (err) {
      console.error('Failed to generate login URL:', err);
      setError('Failed to generate login link. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogin = () => {
    if (loginUrl) {
      // Direct navigation - most reliable
      window.location.href = loginUrl;
    } else {
      // Fallback to direct Telegram link
      const loginCode = `LOGIN${Date.now()}`;
      window.location.href = `https://t.me/${BOT_USERNAME}?start=${loginCode}`;
    }
  };

  return (
    <div className="w-full space-y-4">
      <Button
        onClick={handleLogin}
        disabled={isGenerating}
        className="w-full h-12 sm:h-11 text-base sm:text-sm font-medium bg-[#0088cc] hover:bg-[#0077bb] text-white border-0 transition-colors"
        size="lg"
      >
        <Send className="mr-2 h-4 w-4" />
        {isGenerating ? 'Preparing...' : 'Continue with Telegram'}
      </Button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="text-xs text-muted-foreground text-center">
        <p>Having trouble? Modern browsers may block third-party cookies.</p>
        <p>Try enabling cookies or use a different browser if the button doesn't work.</p>
      </div>
    </div>
  );
}
