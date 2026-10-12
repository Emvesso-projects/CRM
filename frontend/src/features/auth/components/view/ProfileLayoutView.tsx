import { Outlet } from "react-router-dom";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Camera,
  Eye,
  Loader2,
  LogOut,
  Mail,
  Moon,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/common/PageHeader";
import TooltipLabel from "@/components/common/TooltipLabel";
import { pagePanelClass } from "@/components/common/uiTokens";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import type { ApiError } from "@/types/api";
import { resolveAssetUrl } from "@/utils/assetUrl";
import { toast } from "@/utils/toast";
import { cn } from "@/utils/cn";
import { logout, updateProfile } from "../../store/slice";
import { selectCurrentUser } from "../../store/selectors";

const formatRole = (role?: string) => {
  if (!role) return "";

  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const AccountMetaItem = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value?: string | null;
}) => (
  <div className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3 py-2">
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
    </span>
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">
        {value || "-"}
      </dd>
    </div>
  </div>
);

const ProfileLayoutView = () => {
  const user = useAppSelector(selectCurrentUser);
  const dispatch = useAppDispatch();
  const { resolvedTheme, setTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isFullViewOpen, setIsFullViewOpen] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  useEffect(() => {
    setImageLoadError(false);
  }, [user?.profileImage]);

  if (!user) {
    return null;
  }

  const profileImageUrl = resolveAssetUrl(user.profileImage);
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const organizationName = user.organization?.name ?? null;

  const handleProfileImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only jpg, jpeg, png, or webp images are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Uploaded image must be 5MB or smaller.");
      event.target.value = "";
      return;
    }

    const payload = new FormData();
    payload.append("firstName", user.firstName ?? "");
    payload.append("lastName", user.lastName ?? "");
    payload.append("mobile", user.mobile ?? "");
    payload.append("profileImage", file);

    try {
      setIsUploadingProfileImage(true);
      // .unwrap() is what makes a rejected thunk throw. Without it the action
      // resolves either way, the catch never runs, and a failed upload just
      // stops the spinner as though it had worked.
      await dispatch(updateProfile(payload)).unwrap();
      toast.success("Profile photo updated.");
    } catch (error) {
      // The thunk rejects with an ApiError, so prefer the server's wording —
      // it explains *why* (file too large, wrong type) far better than we can.
      const message = (error as ApiError | undefined)?.message;
      toast.error(
        message || "Could not update your profile photo. Please try again.",
      );
    } finally {
      event.target.value = "";
      setIsUploadingProfileImage(false);
    }
  };

  const handleRemoveProfileImage = async () => {
    try {
      setIsUploadingProfileImage(true);
      await dispatch(updateProfile({ profileImage: null })).unwrap();
      setIsFullViewOpen(false);
      toast.success("Profile photo removed.");
    } catch (error) {
      const message = (error as ApiError | undefined)?.message;
      toast.error(
        message || "Could not remove your profile photo. Please try again.",
      );
    } finally {
      setIsUploadingProfileImage(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
      <PageHeader
        title="Profile"
        description="Manage your account details and security settings."
        className="shrink-0"
      />

      <div className="grid min-w-0 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:h-full lg:overflow-hidden">
          <section
            className={cn(
              pagePanelClass,
              "flex flex-col gap-4 lg:h-full",
            )}
          >
            <div className="space-y-4 ">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <button
                    type="button"
                    disabled={isUploadingProfileImage}
                    onClick={() => {
                      if (profileImageUrl && !imageLoadError) {
                        setIsFullViewOpen(true);
                      } else {
                        profileImageInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      "group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-bold text-muted-foreground ring-2 ring-border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                      profileImageUrl && !imageLoadError && "hover:ring-primary/60 hover:shadow-md",
                    )}
                    aria-label={
                      profileImageUrl && !imageLoadError
                        ? "View profile photo in full size"
                        : "Upload profile photo"
                    }
                  >
                    {profileImageUrl && !imageLoadError ? (
                      <>
                        <img
                          src={profileImageUrl}
                          alt={userName || user.email}
                          onError={() => setImageLoadError(true)}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <Eye className="h-6 w-6 text-white drop-shadow-sm" />
                        </div>
                      </>
                    ) : (
                      <span className="uppercase">
                        {user.firstName?.[0]}
                        {user.lastName?.[0]}
                      </span>
                    )}

                    {isUploadingProfileImage && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-xs">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </button>

                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleProfileImageChange}
                  />

                  {profileImageUrl && !imageLoadError ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={isUploadingProfileImage}
                          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-background text-foreground shadow-md transition-all hover:bg-muted hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                          aria-label="Profile photo options"
                        >
                          {isUploadingProfileImage ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" side="bottom" className="w-44">
                        <DropdownMenuItem
                          onClick={() => setIsFullViewOpen(true)}
                          className="gap-2.5 cursor-pointer"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span>View photo</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => profileImageInputRef.current?.click()}
                          className="gap-2.5 cursor-pointer"
                        >
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span>Update photo</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={handleRemoveProfileImage}
                          className="gap-2.5 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Remove photo</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <TooltipLabel label="Upload profile photo">
                      <button
                        type="button"
                        disabled={isUploadingProfileImage}
                        onClick={() => profileImageInputRef.current?.click()}
                        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-background text-foreground shadow-md transition-all hover:bg-muted hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                        aria-label="Upload profile photo"
                      >
                        {isUploadingProfileImage ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </button>
                    </TooltipLabel>
                  )}
                </div>

                <div className="mt-3 min-w-0">
                  <h2 className="truncate text-lg font-bold text-foreground">
                    {userName || user.email}
                  </h2>
                  <p className="mt-1 truncate text-sm font-medium text-muted-foreground">
                    {formatRole(user.role)}
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-border border-y border-border">
                <AccountMetaItem icon={Mail} label="Email" value={user.email} />
                <AccountMetaItem
                  icon={BadgeCheck}
                  label="Role"
                  value={formatRole(user.role)}
                />
                {organizationName && (
                  <AccountMetaItem
                    icon={Building2}
                    label="Organization"
                    value={organizationName}
                  />
                )}
              </dl>
            </div>

            <div className="mt-auto space-y-2 border-t border-border pt-4">
              <TooltipLabel
                label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                  aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
                  className="h-9 w-full rounded-md border-border bg-background px-4 text-sm font-semibold text-foreground shadow-none hover:bg-muted"
                >
                  {isDarkMode ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                  {isDarkMode ? "Light Mode" : "Dark Mode"}
                </Button>
              </TooltipLabel>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void dispatch(logout());
                }}
                className="h-9 w-full rounded-md border-destructive/30 bg-background px-4 text-sm font-semibold text-destructive shadow-none hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </section>
        </aside>

        <div className="min-w-0 lg:h-full lg:overflow-y-auto lg:pr-2">
          <Outlet context={{ isProfileEditing, setIsProfileEditing }} />
        </div>
      </div>

      {profileImageUrl && !imageLoadError && (
        <Dialog open={isFullViewOpen} onOpenChange={setIsFullViewOpen}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border bg-card">
            <DialogHeader className="p-4 pb-2 text-left">
              <DialogTitle className="text-base font-semibold">
                Profile Photo
              </DialogTitle>
            </DialogHeader>

            <div className="relative flex max-h-[65vh] min-h-[220px] w-full items-center justify-center bg-muted/40 p-4">
              <img
                src={profileImageUrl}
                alt={userName || user.email}
                className="max-h-[55vh] w-auto max-w-full rounded-xl object-contain shadow-md"
              />
            </div>

            <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t border-border bg-card/80 p-3 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingProfileImage}
                onClick={async () => {
                  await handleRemoveProfileImage();
                }}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingProfileImage}
                  onClick={() => {
                    profileImageInputRef.current?.click();
                  }}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Change
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsFullViewOpen(false)}
                >
                  Done
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ProfileLayoutView;
