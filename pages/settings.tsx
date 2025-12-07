import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Navigation } from "@/components/navigation";
import { User, Lock, Camera } from "lucide-react";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { toast } from "sonner";

export default function SettingsPage() {
  const supabase = useMemo(() => createSupabaseComponentClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [imageError, setImageError] = useState(false);

  const refreshUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      setIsLoadingProfile(false);
      return null;
    }

    const user = data.user;
    setUsername(user.user_metadata?.username ?? "");
    setEmail(user.email ?? "");
    setAvatarUrl(user.user_metadata?.avatar_url ?? null);
    setAvatarPath(user.user_metadata?.avatar_path ?? null);
    setImageError(false);
    setIsLoadingProfile(false);
    return user;
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    void refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    setIsUploadingAvatar(true);
    const tempUrl = URL.createObjectURL(file);
    setPreviewUrl(tempUrl);
    setImageError(false);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("No user found");

      const user = data.user;
      const fileExt = file.name.split(".").pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      const bucket = "avatars";

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true, cacheControl: "3600" });

      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 31536000); // 1 year expiry

      if (signedError) throw signedError;
      
      const signedUrl = signedData.signedUrl;

      const metadata = {
        ...user.user_metadata,
        avatar_url: signedUrl,
        avatar_path: filePath,
      };

      const { error: updateError } = await supabase.auth.updateUser({
        data: metadata,
      });

      if (updateError) throw updateError;

      setAvatarUrl(signedUrl);
      setAvatarPath(filePath);
      void refreshUser();
      toast.success("Avatar updated");
      setPreviewUrl(null);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      const message = error instanceof Error ? error.message : "Failed to upload avatar";
      toast.error(message);
      setPreviewUrl(null);
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdateProfile = async () => {
    setIsSavingProfile(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("Not signed in");

      const user = data.user;
      const metadata = {
        ...user.user_metadata,
        username,
        avatar_url: avatarUrl ?? user.user_metadata?.avatar_url ?? null,
        avatar_path: avatarPath ?? user.user_metadata?.avatar_path ?? null,
      };

      const payload: { email?: string; data: Record<string, unknown> } = {
        data: metadata,
      };

      const emailChanged = email && email !== user.email;
      if (emailChanged) {
        payload.email = email;
      }

      const { error: updateError } = await supabase.auth.updateUser(payload);
      if (updateError) throw updateError;

      await refreshUser();
      toast.success(emailChanged ? "Check your inbox to confirm your new email." : "Profile updated");
    } catch (error) {
      console.error("Error updating profile:", error);
      const message = error instanceof Error ? error.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      alert("Enter your current password to continue.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }

    setIsSavingPassword(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || !data.user.email) throw error ?? new Error("Not signed in");

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: data.user.email,
        password: currentPassword,
      });

      if (reauthError) throw new Error("Current password is incorrect");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error updating password:", error);
      const message = error instanceof Error ? error.message : "Failed to update password";
      toast.error(message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-4xl p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your account preferences and settings
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <CardTitle>Profile Information</CardTitle>
              </div>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-border bg-muted">
                    {(previewUrl || avatarUrl) && !imageError ? (
                      <img
                        key={(previewUrl ?? avatarUrl) ?? "avatar"}
                        src={previewUrl ?? avatarUrl ?? ""}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <User className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar || isLoadingProfile}
                    className="gap-2"
                  >
                    {isUploadingAvatar ? (
                      "Uploading..."
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        Change Avatar
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">Max 2MB</p>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoadingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoadingProfile}
                    />
                    <p className="text-sm text-muted-foreground">
                      Changing your email will trigger a confirmation link.
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={handleUpdateProfile} disabled={isSavingProfile || isLoadingProfile}>
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                <CardTitle>Security</CardTitle>
              </div>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isLoadingProfile}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoadingProfile}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoadingProfile}
                />
              </div>
              <Button onClick={handleUpdatePassword} disabled={isSavingPassword || isLoadingProfile}>
                {isSavingPassword ? "Updating..." : "Update Password"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const supabase = createSupabaseServerClient(context);
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: { id: userData.claims.sub },
    },
  };
}
