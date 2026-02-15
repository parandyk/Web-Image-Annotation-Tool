import { GeneralTab } from './tabs/GeneralTab';
import { ImagesTab } from './tabs/ImagesTab';
import { ClassesTab } from './tabs/ClassesTab';
import { SettingsTab } from './tabs/SettingsTab';

type Tab = 'general' | 'images' | 'annotations' | 'classes' | 'settings';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'images', label: 'Images' },
  { id: 'annotations', label: 'Annotations' },
  { id: 'classes', label: 'Classes' },
  { id: 'settings', label: 'Settings' },
];

export function Sidebar(props: {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}): JSX.Element {
  const { tab, onTabChange } = props;

  return (
    <aside className="sidebar">
      {/* Sidebar tabs only switch views; data/state is owned by the global store. */}
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-body">
        {tab === 'general' && <GeneralTab />}
        {tab === 'images' && <ImagesTab view="images" />}
        {tab === 'annotations' && <ImagesTab view="annotations" />}
        {tab === 'classes' && <ClassesTab />}
        {tab === 'settings' && <SettingsTab variant="sidebar" />}
      </div>
    </aside>
  );
}
