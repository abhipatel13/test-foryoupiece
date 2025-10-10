'use client'

import { useState, useEffect, FC } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone, User, Edit, MapPin, CreditCard, Save, Trash2, X } from 'lucide-react';
import { getCorrectUserTier, getTierStyling } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ProfileInfoCardProps {
    profile: any;
    updateProfile: (updates: any) => Promise<any>;
}

export const ProfileInfoCard: FC<ProfileInfoCardProps> = ({ profile, updateProfile }) => {
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [addressData, setAddressData] = useState({ address_line_1: '', address_line_2: '', aba_bank_name: '' });
    const [savingAddress, setSavingAddress] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileData, setProfileData] = useState({ first_name: '', last_name: '', phone: '', email: '' });
    const [savingProfile, setSavingProfile] = useState(false);

    // --- FIX: Safeguarded form state ---
    // REASONING: The `!isEditing...` check prevents background profile updates
    // from overwriting the user's active edits in the form.
    useEffect(() => {
        if (profile && !isEditingAddress) {
            setAddressData({
                address_line_1: profile.address_line_1 || '',
                address_line_2: profile.address_line_2 || '',
                aba_bank_name: profile.aba_bank_name || '',
            });
        }
    }, [profile, isEditingAddress]);

    useEffect(() => {
        if (profile && !isEditingProfile) {
            setProfileData({
                first_name: profile.first_name || '',
                last_name: profile.last_name || '',
                phone: profile.phone || '',
                email: profile.email || '',
            });
        }
    }, [profile, isEditingProfile]);

    const handleSaveAddress = async () => {
        if (!addressData.address_line_1 || !addressData.aba_bank_name) {
            toast.error('Please fill in Address Line 1 and ABA Bank Name');
            return;
        }
        setSavingAddress(true);
        try {
            await updateProfile({
                address_line_1: addressData.address_line_1,
                address_line_2: addressData.address_line_2 || null,
                aba_bank_name: addressData.aba_bank_name || null,
            });
            setIsEditingAddress(false);
            toast.success('Address information updated successfully!');
        } catch (error) {
            Sentry.captureException(error);
            toast.error('Failed to update address information');
        } finally {
            setSavingAddress(false);
        }
    };
    
    const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
            await updateProfile({
                first_name: profileData.first_name || null,
                last_name: profileData.last_name || null,
                phone: profileData.phone || null,
            });
            setIsEditingProfile(false);
            toast.success('Profile updated successfully!');
        } catch (error) {
            Sentry.captureException(error);
            toast.error('Failed to update profile');
        } finally {
            setSavingProfile(false);
        }
    };
    
    const handleDeleteAddress = async () => {
        if (!confirm('Are you sure you want to delete your saved address and ABA bank information?')) {
          return
        }
        setSavingAddress(true)
        try {
          await updateProfile({
            address_line_1: null,
            address_line_2: null,
            aba_bank_name: null
          })
          toast.success('Address information deleted successfully!')
        } catch (error) {
          Sentry.captureException(error)
          toast.error('Failed to delete address information')
        } finally {
          setSavingAddress(false)
        }
    };

    const getTierColor = (tier: string) => {
        const tierStyling = getTierStyling(tier);
        return tierStyling.premiumBadgeClass || tierStyling.badgeClass;
    };
    const getTierIcon = (tier: string) => {
        switch (tier) {
            case 'diamond': return '💎';
            case 'platinum': return '🏆';
            case 'gold': return '🥇';
            case 'silver': return '🥈';
            default: return '🥉';
        }
    };

    return (
        <Card role="region" aria-labelledby="profile-info-title" className="lg:col-span-1">
            <CardHeader className="text-center pb-4 sm:pb-6 pt-6">
                <Avatar className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-5 ring-4 ring-blue-100">
                    <AvatarImage src={profile?.avatar_url || ''} alt={profile?.first_name ? `${profile.first_name} ${profile.last_name}` : 'User avatar'} />
                    <AvatarFallback className="text-lg sm:text-xl font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                        {profile?.first_name?.[0] || profile?.telegram_username?.[0] || 'U'}
                    </AvatarFallback>
                </Avatar>
                <CardTitle id="profile-info-title" className="text-lg sm:text-xl">
                    {profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : profile?.telegram_username || 'User'}
                </CardTitle>
                <CardDescription className="text-sm">{profile?.email || 'Telegram User'}</CardDescription>
                {profile && (
                <div className="mt-3 flex justify-center">
                    <Badge className={`px-4 py-2 text-sm font-bold border-2 ${getTierColor(getCorrectUserTier(profile))}`}>
                    <span className="mr-2 text-base">{getTierIcon(getCorrectUserTier(profile))}</span>
                    {getCorrectUserTier(profile).toUpperCase()} MEMBER
                    </Badge>
                </div>
                )}
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
                {!isEditingProfile ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Profile Information</h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)} className="h-8 px-2 text-xs">
                        <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                    <div className="flex items-center"><User className="h-4 w-4 mr-2 text-gray-400" /><span>{profile?.first_name || 'Not set'} {profile?.last_name || ''}</span></div>
                    <div className="flex items-center"><Mail className="h-4 w-4 mr-2 text-gray-400" /><span>{profile?.email || 'Not set'}</span></div>
                    <div className="flex items-center"><Phone className="h-4 w-4 mr-2 text-gray-400" /><span>{profile?.phone || 'Not set'}</span></div>
                    </div>
                </div>
                ) : (
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-700">Edit Profile</h3>
                    <div className="space-y-3">
                    <div><Label htmlFor="first_name" className="text-xs">First Name</Label><Input id="first_name" value={profileData.first_name} onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))} className="mt-1" /></div>
                    <div><Label htmlFor="last_name" className="text-xs">Last Name</Label><Input id="last_name" value={profileData.last_name} onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))} className="mt-1" /></div>
                    <div><Label htmlFor="phone" className="text-xs">Phone</Label><Input id="phone" value={profileData.phone} onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))} className="mt-1" /></div>
                    <div><Label htmlFor="email" className="text-xs">Email (Read-only)</Label><Input id="email" value={profileData.email} disabled className="mt-1 bg-gray-50" /></div>
                    </div>
                    <div className="flex gap-2">
                    <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm" className="min-h-[44px] flex-1">
                        {savingProfile ? <><Save className="h-3 w-3 mr-1 animate-spin" />Saving...</> : <><Save className="h-3 w-3 mr-1" />Save</>}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingProfile(false)} size="sm" className="min-h-[44px]"><X className="h-3 w-3 mr-1" />Cancel</Button>
                    </div>
                </div>
                )}
                <Separator />
                {!isEditingAddress ? (
                    <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-700">Delivery Address</h3>
                        <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingAddress(true)} className="h-8 px-2 text-xs">
                            <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        {(profile?.address_line_1 || profile?.aba_bank_name) && (
                            <Button variant="ghost" size="sm" onClick={handleDeleteAddress} disabled={savingAddress} className="h-8 px-2 text-xs text-red-600 hover:text-red-700">
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                            </Button>
                        )}
                        </div>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-start">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                        <div>
                            <div>{profile?.address_line_1 || 'No address saved'}</div>
                            {profile?.address_line_2 && <div>{profile.address_line_2}</div>}
                        </div>
                        </div>
                        <div className="flex items-center">
                        <CreditCard className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{profile?.aba_bank_name || 'No ABA bank saved'}</span>
                        </div>
                    </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-700">Edit Address</h3>
                    <div className="space-y-3">
                        <div><Label htmlFor="address_line_1" className="text-xs">Address Line 1 *</Label><Input id="address_line_1" value={addressData.address_line_1} onChange={(e) => setAddressData(prev => ({ ...prev, address_line_1: e.target.value }))} placeholder="Enter your address" className="mt-1" required/></div>
                        <div><Label htmlFor="address_line_2" className="text-xs">Address Line 2</Label><Input id="address_line_2" value={addressData.address_line_2} onChange={(e) => setAddressData(prev => ({ ...prev, address_line_2: e.target.value }))} placeholder="Apartment, suite, etc. (optional)" className="mt-1"/></div>
                        <div><Label htmlFor="aba_bank_name" className="text-xs">ABA Bank Name *</Label><Input id="aba_bank_name" value={addressData.aba_bank_name} onChange={(e) => setAddressData(prev => ({ ...prev, aba_bank_name: e.target.value }))} placeholder="Taravatey Than" className="mt-1" required/></div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleSaveAddress} disabled={savingAddress} size="sm" className="min-h-[44px] flex-1">
                        {savingAddress ? <><Save className="h-3 w-3 mr-1 animate-spin" />Saving...</> : <><Save className="h-3 w-3 mr-1" />Save</>}
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditingAddress(false)} size="sm" className="min-h-[44px]"><X className="h-3 w-3 mr-1" />Cancel</Button>
                    </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};