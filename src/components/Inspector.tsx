import type { ComponentGroup, Entry, OnyomiGroup, StrongGroup } from "../data/types";
import { useModel } from "../data/context";
import { useAtlasStore } from "../state/store";
import { Icon } from "./Icon";
import { Stars } from "./Controls";
import { readingList } from "../lib/format";
import { assetUrl } from "../lib/asset";

function ReadingChips({ entry }: { entry: Entry }) {
  const model = useModel();
  if (!entry.readings.length) {
    return <p className="inspector-empty">No onyomi in KanjiDamage. This entry is not given a guessed reading.</p>;
  }
  return (
    <div className="reading-chip-list">
      {entry.readings.map((reading) => {
        const keyword = model.getKeyword(reading);
        const mnemonic = entry.onyomi.find((item) => item.reading.toUpperCase().includes(reading))?.mnemonic;
        return (
          <div className="reading-chip" key={reading}>
            <strong>{reading}</strong>
            {keyword ? <span>{keyword}</span> : null}
            {mnemonic ? <small>{mnemonic}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

function MemberRow({
  entry,
  note,
  status,
  onSelect,
}: {
  entry: Entry;
  note?: string;
  status?: "pass" | "exception" | "unknown";
  onSelect: (id: number) => void;
}) {
  return (
    <button type="button" className={"member-row" + (status === "exception" ? " exception" : "")} onClick={() => onSelect(entry.id)}>
      <span className="member-glyph" lang="ja">{entry.kanji ?? "部"}</span>
      <span className="member-copy">
        <strong>{entry.meaning}</strong>
        <small>{note ?? (entry.readings.length ? readingList(entry.readings) : "no onyomi data")}</small>
      </span>
      {status ? <span className={"status-dot " + status} aria-label={status} /> : null}
    </button>
  );
}

function EntryInspector({ entry }: { entry: Entry }) {
  const model = useModel();
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const selectGroup = useAtlasStore((state) => state.selectGroup);
  const requestGroupFocus = useAtlasStore((state) => state.requestGroupFocus);
  const setMode = useAtlasStore((state) => state.setMode);
  const setInputKanji = useAtlasStore((state) => state.setInputKanji);
  const setComponentCenter = useAtlasStore((state) => state.setComponentCenter);
  const pinned = useAtlasStore((state) => state.pinned);
  const togglePinned = useAtlasStore((state) => state.togglePinned);
  const clearSelection = useAtlasStore((state) => state.clearSelection);

  const readings = model.onyomiGroupsForEntry(entry.id).sort((a, b) => b.count - a.count);
  const strongGroups = model.strongGroupsForEntry(entry.id);
  const primary = model.primaryComponentGroup(entry);
  const isPinned = pinned.includes(entry.id);

  const openComponent = (component: string) => {
    const group = model.componentByGlyph.get(component);
    setMode("components");
    setComponentCenter(component);
    if (group) selectGroup(group.id);
  };

  return (
    <>
      <div className="inspector-scroll">
        <div className="inspector-hero">
          <div className="inspector-glyph" lang="ja">
            {entry.kanji ?? <span className="radical-placeholder">部</span>}
          </div>
          <div>
            <p className="eyebrow">{entry.kanji ? "Kanji" : "Image radical"}</p>
            <h2>{entry.meaning}</h2>
            <div className="inspector-badges">
              <span>{entry.readings.length ? readingList(entry.readings) : "no onyomi"}</span>
              {entry.isSupplement ? <span className="badge-supplement">site supplement</span> : null}
            </div>
          </div>
        </div>

        <div className="inspector-actions">
          <button type="button" className={"button small " + (isPinned ? "active" : "ghost")} onClick={() => togglePinned(entry.id)}>
            <Icon name="pin" size={14} /> {isPinned ? "Pinned" : "Pin to compare"}
          </button>
          {entry.kanji ? (
            <button
              type="button"
              className="button small ghost"
              onClick={() => {
                setMode("lookalikes");
                setInputKanji(entry.kanji!);
                clearSelection();
              }}
            >
              <Icon name="target" size={14} /> Use as input
            </button>
          ) : null}
        </div>

        <section className="inspector-section">
          <h3>Readings</h3>
          <ReadingChips entry={entry} />
          {entry.kunyomi.length ? (
            <p className="kunyomi-line">
              <span>kun</span> {entry.kunyomi.slice(0, 4).map((item) => item.reading).join(" · ")}
            </p>
          ) : null}
        </section>

        <section className="inspector-section">
          <h3>Components <small>{entry.components.length}</small></h3>
          <div className="chip-wrap">
            {entry.components.map((component, index) => {
              const label = component.kanji ?? component.label ?? component.image ?? "?";
              const group = component.kanji ? model.componentByGlyph.get(component.kanji) : null;
              return (
                <button
                  key={String(component.id) + index}
                  type="button"
                  className={"component-chip" + (group ? " linked" : "")}
                  onClick={() => component.kanji && openComponent(component.kanji)}
                  disabled={!group}
                  title={component.label ?? label}
                >
                  <span lang="ja">{label}</span>
                  {component.label ? <small>{component.label}</small> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="inspector-section">
          <h3>At a glance</h3>
          <div className="fact-grid">
            <div><span>Usefulness</span><strong><Stars value={entry.usefulness} /></strong></div>
            <div><span>Strokes</span><strong>{entry.strokeCount ?? "—"}</strong></div>
            <div><span>Frequency</span><strong>{entry.frequencyRank ? "#" + entry.frequencyRank : "—"}</strong></div>
            <div><span>Position</span><strong>{entry.position ?? "—"}</strong></div>
          </div>
          {entry.tags.length ? (
            <div className="chip-wrap tag-wrap">
              {entry.tags.map((tag) => (
                <span className="tag-chip" key={tag} title={model.tagsByName.get(tag)}>{tag}</span>
              ))}
            </div>
          ) : null}
        </section>

        {readings.length ? (
          <section className="inspector-section">
            <h3>Onyomi groups</h3>
            <div className="link-chip-list">
              {readings.map((group) => (
                <button key={group.id} type="button" onClick={() => { setMode("onyomi"); requestGroupFocus(group.id); }}>
                  <strong>{group.reading}</strong>
                  <span>{group.keyword ?? group.count + " kanji"}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {strongGroups.length ? (
          <section className="inspector-section">
            <h3>Strong families <small>{strongGroups.length}</small></h3>
            <div className="strong-group-list">
              {strongGroups.map((group) => {
                const member = group.members.find((item) => item.id === entry.id);
                const exception = member?.status === "exception";
                return (
                  <button
                    key={group.id}
                    type="button"
                    className={"strong-group-row" + (exception ? " exception" : "")}
                    onClick={() => { setMode("strong"); requestGroupFocus(group.id); }}
                  >
                    <span className="strong-group-glyph" lang="ja">{group.glyph ?? "強"}</span>
                    <span>
                      <strong>{group.readings.join(" / ")}</strong>
                      <small>{exception ? "exception" : member?.status === "pass" ? "matches" : "unknown"}</small>
                    </span>
                    {exception ? <span className="status-pill exception">!</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {primary ? (
          <section className="inspector-section">
            <h3>Primary component</h3>
            <button
              type="button"
              className="primary-component-card"
              onClick={() => { setMode("components"); setComponentCenter(primary.component); selectGroup(primary.id); }}
            >
              <span lang="ja">{primary.component}</span>
              <div>
                <strong>{primary.meaning ?? "component"}</strong>
                <small>{primary.primaryIds.length} primary · {primary.count} containing</small>
              </div>
              <Icon name="arrow-right" size={15} />
            </button>
          </section>
        ) : null}

        {entry.lookalikes.length ? (
          <section className="inspector-section">
            <h3>KanjiDamage look-alikes</h3>
            <div className="lookalike-list">
              {entry.lookalikes.map((look, index) => (
                <button
                  key={String(look.id) + index}
                  type="button"
                  onClick={() => {
                    const target = look.id ? model.byId.get(look.id) : look.kanji ? model.byKanji.get(look.kanji) : null;
                    if (target) selectEntry(target.id);
                  }}
                >
                  <span lang="ja">{look.kanji ?? "?"}</span>
                  <div><strong>{look.meaning ?? "look-alike"}</strong><small>{look.hint ?? ""}</small></div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {entry.mnemonic || entry.description ? (
          <section className="inspector-section">
            <h3>Notes</h3>
            {entry.mnemonic ? <p className="prose">{entry.mnemonic}</p> : null}
            {entry.description ? (
              <details className="prose-details">
                <summary>KanjiDamage description</summary>
                <p>{entry.description}</p>
              </details>
            ) : null}
          </section>
        ) : null}

        {entry.jukugo.length ? (
          <section className="inspector-section">
            <h3>Jukugo</h3>
            <ul className="jukugo-list">
              {entry.jukugo.map((item) => (
                <li key={item.word}>
                  <span lang="ja">{item.word}</span>
                  <small>{item.reading} · {item.meaning}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="inspector-footer">
        {entry.url ? (
          <a className="text-link" href={entry.url} target="_blank" rel="noreferrer">
            KanjiDamage page <Icon name="external" size={13} />
          </a>
        ) : null}
        <button type="button" className="text-button" onClick={clearSelection}>Close</button>
      </div>
    </>
  );
}

function GroupInspector({ groupId }: { groupId: string }) {
  const model = useModel();
  const selectEntry = useAtlasStore((state) => state.selectEntry);
  const selectGroup = useAtlasStore((state) => state.selectGroup);
  const requestGroupFocus = useAtlasStore((state) => state.requestGroupFocus);
  const setMode = useAtlasStore((state) => state.setMode);
  const setComponentCenter = useAtlasStore((state) => state.setComponentCenter);
  const setOnyomiShowAll = useAtlasStore((state) => state.setOnyomiShowAll);
  const showAll = useAtlasStore((state) => state.componentShowAll);
  const setShowAll = useAtlasStore((state) => state.setComponentShowAll);
  const togglePinned = useAtlasStore((state) => state.togglePinned);
  const pinned = useAtlasStore((state) => state.pinned);
  const clearSelection = useAtlasStore((state) => state.clearSelection);
  const kind = groupId.split(":")[0];

  if (kind === "onyomi") {
    const group = model.data.onyomiGroups.find((item) => item.id === groupId) as OnyomiGroup | undefined;
    if (!group) return null;
    const members = group.memberIds.map((id) => model.byId.get(id)).filter((entry): entry is Entry => Boolean(entry?.kanji));
    const similar = model.data.onyomiLinks
      .filter((link) => link.source === groupId || link.target === groupId)
      .map((link) => ({ link, other: link.source === groupId ? link.target : link.source }))
      .sort((a, b) => b.link.similarity - a.link.similarity)
      .slice(0, 6);
    return (
      <>
        <div className="inspector-scroll">
          <div className="group-hero">
            <p className="eyebrow">Onyomi group</p>
            <h2>{group.reading}</h2>
            <p>{group.keyword ?? "reading"}</p>
            <div className="group-meta"><span>{group.count} kanji</span><span>{members.filter((entry) => entry.readings.length > 1).length} multi-reading</span></div>
            <button
              type="button"
              className="button small ghost focus-reading-action"
              onClick={() => {
                setOnyomiShowAll(false);
                requestGroupFocus(group.id);
              }}
            >
              <Icon name="target" size={13} /> Focus neighbourhood
            </button>
          </div>
          <section className="inspector-section">
            <h3>Members <small>{members.length}</small></h3>
            <div className="member-list">
              {members.map((entry) => <MemberRow key={entry.id} entry={entry} onSelect={selectEntry} />)}
            </div>
          </section>
          {similar.length ? (
            <section className="inspector-section">
              <h3>Sounds nearby</h3>
              <div className="link-chip-list">
                {similar.map(({ link, other }) => {
                  const target = model.data.onyomiGroups.find((item) => item.id === other);
                  if (!target) return null;
                  return (
                    <button key={other} type="button" onClick={() => requestGroupFocus(other)}>
                      <strong>{target.reading}</strong>
                      <span>{Math.round(link.similarity * 100)}% similar</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
        <div className="inspector-footer"><button type="button" className="text-button" onClick={clearSelection}>Close</button></div>
      </>
    );
  }

  if (kind === "strong") {
    const group = model.strongById.get(groupId) as StrongGroup | undefined;
    if (!group) return null;
    const center = model.byId.get(group.entryId);
    const members = group.members.map((member) => ({ member, entry: model.byId.get(member.id) })).filter((row): row is { member: StrongGroup["members"][number]; entry: Entry } => Boolean(row.entry?.kanji));
    const isPinned = center ? pinned.includes(center.id) : false;
    return (
      <>
        <div className="inspector-scroll">
          <div className="group-hero strong-hero">
            <div className="group-hero-glyph" lang="ja">
              {group.image ? <img src={assetUrl("media/strong/" + group.image)} alt={group.meaning} /> : group.glyph}
            </div>
            <div>
              <p className="eyebrow">Strong family · {group.source}</p>
              <h2>{group.meaning}</h2>
              <p className="strong-readings">{group.readings.join(" / ") || "reading unknown"}</p>
            </div>
          </div>
          <div className="strong-counts">
            <span><b>{group.counts.pass}</b> pass</span>
            <span className="danger"><b>{group.counts.exception}</b> exception</span>
            <span><b>{group.counts.noReading}</b> blank</span>
            <span><b>{group.counts.radical}</b> radical</span>
          </div>
          {group.note ? <blockquote className="provenance">{group.note}</blockquote> : null}
          {center ? (
            <div className="center-actions">
              <button type="button" className="button small ghost" onClick={() => selectEntry(center.id)}>
                Open {center.kanji ?? center.meaning}
              </button>
              <button type="button" className={"button small " + (isPinned ? "active" : "ghost")} onClick={() => togglePinned(center.id)}>
                <Icon name="pin" size={14} /> {isPinned ? "Pinned" : "Pin center"}
              </button>
            </div>
          ) : null}
          <section className="inspector-section">
            <h3>Used In <small>{members.length}</small></h3>
            <div className="member-list">
              {members.map(({ member, entry }) => (
                <MemberRow
                  key={entry.id}
                  entry={entry}
                  status={member.status === "unknown" ? "unknown" : member.status}
                  note={(member.readings.length ? member.readings.join(" · ") : "no onyomi data") + (member.reason === "reading-mismatch" ? " · mismatch" : member.reason === "no-reading" ? " · counted as exception" : "")}
                  onSelect={selectEntry}
                />
              ))}
            </div>
          </section>
          {group.radicalMembers.length ? (
            <section className="inspector-section">
              <h3>Radical members</h3>
              <div className="radical-list">
                {group.radicalMembers.map((member) => (
                  <div className="radical-row" key={member.id}>
                    {member.image ? <img src={assetUrl("media/strong/" + member.image)} alt={member.meaning ?? "radical"} /> : <span className="radical-placeholder">部</span>}
                    <span>{member.meaning ?? "image radical"}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {group.empty ? <p className="inspector-empty">This strong entry has no Used In entries in KanjiDamage.</p> : null}
        </div>
        <div className="inspector-footer"><button type="button" className="text-button" onClick={clearSelection}>Close</button></div>
      </>
    );
  }

  if (kind === "component") {
    const group = model.data.componentGroups.find((item) => item.id === groupId) as ComponentGroup | undefined;
    if (!group) return null;
    const ids = showAll ? group.allIds : group.primaryIds.length ? group.primaryIds : group.allIds;
    const members = ids.map((id) => model.byId.get(id)).filter((entry): entry is Entry => Boolean(entry?.kanji));
    const primary = new Set(group.primaryIds);
    return (
      <>
        <div className="inspector-scroll">
          <div className="group-hero component-hero">
            <div className="group-hero-glyph" lang="ja">{group.component}</div>
            <div>
              <p className="eyebrow">Component group</p>
              <h2>{group.meaning ?? "component"}</h2>
              <p>{group.count} contain it · {group.primaryIds.length} primary</p>
            </div>
          </div>
          <div className="inspector-actions">
            <button type="button" className="button small ghost" onClick={() => { setMode("components"); setComponentCenter(group.component); }}>
              <Icon name="target" size={14} /> Focus neighbourhood
            </button>
            <button type="button" className="button small ghost" onClick={() => setShowAll(!showAll)}>
              <Icon name="layers" size={14} /> {showAll ? "All containing" : "Primary only"}
            </button>
          </div>
          <section className="inspector-section">
            <h3>{showAll ? "All containing" : "Primary members"} <small>{members.length}</small></h3>
            <div className="member-list">
              {members.map((entry) => (
                <MemberRow
                  key={entry.id}
                  entry={entry}
                  note={entry.meaning + (primary.has(entry.id) ? " · primary" : "")}
                  onSelect={selectEntry}
                />
              ))}
            </div>
          </section>
          {group.focusNeighbors.length ? (
            <section className="inspector-section">
              <h3>Similar component groups</h3>
              <div className="neighbour-list">
                {group.focusNeighbors.slice(0, 6).map((neighbour) => {
                  const target = model.data.componentGroups.find((item) => item.id === neighbour.id);
                  if (!target) return null;
                  return (
                    <button key={target.id} type="button" onClick={() => { setComponentCenter(target.component); selectGroup(target.id); }}>
                      <span lang="ja">{target.component}</span>
                      <span><strong>{target.meaning ?? "component"}</strong><small>{Math.round(neighbour.similarity * 100)}% · {target.count} kanji</small></span>
                      <Icon name="chevron-right" size={14} />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
        <div className="inspector-footer"><button type="button" className="text-button" onClick={clearSelection}>Close</button></div>
      </>
    );
  }

  return null;
}

export function Inspector() {
  const model = useModel();
  const selectedEntryId = useAtlasStore((state) => state.selectedEntryId);
  const selectedGroupId = useAtlasStore((state) => state.selectedGroupId);
  const clearSelection = useAtlasStore((state) => state.clearSelection);

  if (!selectedEntryId && !selectedGroupId) return null;
  const entry = selectedEntryId ? model.byId.get(selectedEntryId) : null;

  return (
    <aside className="inspector" aria-label="Selection details">
      <header className="inspector-header">
        <span>{selectedEntryId ? "Kanji" : "Group"}</span>
        <button type="button" className="icon-button" onClick={clearSelection} aria-label="Close inspector">
          <Icon name="close" />
        </button>
      </header>
      {entry ? <EntryInspector entry={entry} /> : null}
      {!entry && selectedGroupId ? <GroupInspector groupId={selectedGroupId} /> : null}
    </aside>
  );
}
