import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { About } from "./About";
import { useAuth } from "@/contexts/AuthContext";

interface SettingTabsProps {
    setSaveSuccess: (success: boolean | null) => void;
    defaultTab?: string;
}

export function SettingTabs({
    setSaveSuccess,
    defaultTab = "about"
}: SettingTabsProps) {
    const { user, organization, signOut } = useAuth();

    const handleTabChange = () => {
        setSaveSuccess(null);
    };

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <Tabs defaultValue={defaultTab} className="w-full" onValueChange={handleTabChange}>
            <TabsList>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>
            <TabsContent value="account" className="space-y-4">
                <div className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Account Information</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium text-gray-600">Email</label>
                            <p className="text-sm text-gray-900">{user?.email}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Full Name</label>
                            <p className="text-sm text-gray-900">{user?.full_name || 'Not set'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Organization</label>
                            <p className="text-sm text-gray-900">{organization?.name || 'No organization'}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-600">AI Model</label>
                            <p className="text-sm text-gray-900">Claude 3.5 Sonnet (SaaS)</p>
                            <p className="text-xs text-gray-500">Model selection is managed by the platform</p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <button
                            onClick={handleSignOut}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="about">
                <About />
            </TabsContent>
        </Tabs>
    )
}