import { useState } from 'react';
import { ClassesTab } from './ClassesTab';
import { CoordinatesPanel } from './CoordinatesPanel';
import { ImagesTab } from './ImagesTab';
import { SettingsTab } from './SettingsTab';

export function GeneralTab(): JSX.Element {
  const [openImages, setOpenImages] = useState(true);
  const [openAnnotations, setOpenAnnotations] = useState(true);
  const [openClasses, setOpenClasses] = useState(true);
  const [openCoordinates, setOpenCoordinates] = useState(true);
  const [openSettings, setOpenSettings] = useState(true);

  return (
    // General tab is a dashboard that embeds other tabs as collapsible sections.
    <div className="panel-stack combined-tab">
      <section className="general-coordinates-segment">
        <div className="row between">
          <h4>Coordinates</h4>
          <button className="collapse-toggle" onClick={() => setOpenCoordinates((v) => !v)}>{openCoordinates ? '▾' : '▸'}</button>
        </div>
        {openCoordinates && <div className="segment-scroll"><CoordinatesPanel /></div>}
      </section>
      <section className="general-images-segment">
        <div className="row between">
          <h4>Images</h4>
          <button className="collapse-toggle" onClick={() => setOpenImages((v) => !v)}>{openImages ? '▾' : '▸'}</button>
        </div>
        {openImages && <div className="segment-scroll"><ImagesTab view="images" /></div>}
      </section>
      <section className="general-annotations-segment">
        <div className="row between">
          <h4>Annotations</h4>
          <button className="collapse-toggle" onClick={() => setOpenAnnotations((v) => !v)}>{openAnnotations ? '▾' : '▸'}</button>
        </div>
        {openAnnotations && <div className="segment-scroll"><ImagesTab view="annotations" /></div>}
      </section>
      <section className="general-classes-segment">
        <div className="row between">
          <h4>Classes</h4>
          <button className="collapse-toggle" onClick={() => setOpenClasses((v) => !v)}>{openClasses ? '▾' : '▸'}</button>
        </div>
        {openClasses && <div className="segment-scroll"><ClassesTab /></div>}
      </section>
      <section className="general-settings-segment">
        <div className="row between">
          <h4>Settings</h4>
          <button className="collapse-toggle" onClick={() => setOpenSettings((v) => !v)}>{openSettings ? '▾' : '▸'}</button>
        </div>
        {openSettings && <div className="segment-scroll"><SettingsTab /></div>}
      </section>
    </div>
  );
}
