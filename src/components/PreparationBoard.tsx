import { useState } from "react";
import { data } from "../lib/app-data";
import {
  needByKey,
  needTitle,
  needs,
  preparationTotals,
  shareHash,
  type PreparationEntry,
  type PreparationMethod,
  type PreparationStatus,
  type Stage,
} from "../lib/preparation";
import { displayTitle } from "../lib/products";
import { PRODUCTION_ORIGIN } from "../lib/site";
import type { Item } from "../types";

const statuses: PreparationStatus[] = [
  "검토 중",
  "준비 예정",
  "준비 완료",
  "준비 안 함",
];
const methods: PreparationMethod[] = ["구매", "선물", "대여", "이미 보유"];
const stages: Stage[] = ["출산 전", "생후 초기", "필요할 때"];
const money = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export function PreparationBoard({
  entries,
  sharedEntries,
  onChange,
  onAddNeed,
  onSelectProduct,
  onCopyShared,
  onCloseShared,
}: {
  entries: PreparationEntry[];
  sharedEntries: PreparationEntry[] | null;
  onChange: (entries: PreparationEntry[]) => void;
  onAddNeed: (needId: string) => void;
  onSelectProduct: (item: Item) => void;
  onCopyShared: () => void;
  onCloseShared: () => void;
}) {
  const [customTitle, setCustomTitle] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const visibleEntries = sharedEntries ?? entries;
  const totals = preparationTotals(visibleEntries);
  const existing = new Set(visibleEntries.map((entry) => entry.id));

  function change(id: string, patch: Partial<PreparationEntry>) {
    onChange(
      entries.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function addCustom() {
    const title = customTitle.trim().slice(0, 60);
    if (!title) return;
    onChange([
      ...entries,
      {
        id: `custom-${crypto.randomUUID()}`,
        title,
        status: "검토 중",
        method: "구매",
        stage: "필요할 때",
        quantity: 1,
        expected: null,
        actual: null,
        productId: null,
        note: "",
      },
    ]);
    setCustomTitle("");
  }

  async function shareList() {
    const hash = shareHash(entries);
    if (hash.length > 30_000) {
      setShareMessage(
        "목록이 길어 주소로 공유할 수 없습니다. 메모를 줄여 주세요.",
      );
      setShareUrl("");
      return;
    }
    const url = `${PRODUCTION_ORIGIN}/${hash}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage("공유 주소를 복사했습니다.");
    } catch {
      setShareMessage("아래 주소를 직접 복사해 주세요.");
    }
  }

  return (
    <section
      id="preparation-board"
      className="preparation-board"
      aria-labelledby="preparation-title"
    >
      <div className="preparation-heading">
        <div>
          <p className="eyebrow">우리 집 육아 준비</p>
          <h2 id="preparation-title">필요한 품목부터 정하세요</h2>
          <p>제품은 후보로 비교하고, 준비 현황은 품목 단위로 기록합니다.</p>
        </div>
        <div className="preparation-progress" aria-live="polite">
          <strong>
            {totals.ready}/{totals.total}
          </strong>
          <span>준비 완료</span>
        </div>
      </div>

      {sharedEntries && (
        <div className="preparation-shared">
          <strong>공유받은 목록 · 열람 전용</strong>
          <p>
            현재 브라우저의 내 목록은 그대로 있습니다. 같은 품목은 내 기록을
            유지하며 공유받은 품목을 추가할 수 있습니다.
          </p>
          <button type="button" onClick={onCopyShared}>
            내 목록에 추가
          </button>
          <button type="button" onClick={onCloseShared}>
            내 목록으로 돌아가기
          </button>
        </div>
      )}

      {visibleEntries.length > 0 && (
        <div className="preparation-budget" aria-label="준비 예산">
          <p>
            <strong>예상 비용 {money(totals.expected)}</strong>
            <span>금액 미입력 {totals.expectedUnknown}품목</span>
          </p>
          <p>
            <strong>실제 지출 {money(totals.actual)}</strong>
            <span>완료 후 금액 미입력 {totals.actualUnknown}품목</span>
          </p>
          <small>
            구매·대여로 표시한 품목만 합산합니다. 금액은 수량 전체의 총액으로
            입력하세요. 미입력 금액은 0원으로 추정하지 않습니다.
          </small>
        </div>
      )}

      {visibleEntries.length === 0 ? (
        <p className="preparation-empty">
          아래에서 우리 집에 필요한 품목을 골라 시작하세요.
        </p>
      ) : (
        <div className="preparation-entries">
          {visibleEntries.map((entry) => {
            const need = needByKey(entry.id);
            const candidates =
              need?.productIds
                .map((id) => data.items.find((item) => item.id === id))
                .filter((item): item is Item => Boolean(item)) ?? [];
            const selected = candidates.find(
              (item) => item.id === entry.productId,
            );
            return (
              <article className="preparation-entry" key={entry.id}>
                <div className="preparation-entry-title">
                  <div>
                    <h3>{needTitle(entry)}</h3>
                    <span>{entry.stage}</span>
                  </div>
                  {!sharedEntries && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(entries.filter((item) => item.id !== entry.id))
                      }
                      aria-label={`${needTitle(entry)} 목록에서 삭제`}
                    >
                      삭제
                    </button>
                  )}
                </div>
                {need?.criterion && (
                  <p className="preparation-guidance">
                    <strong>고를 때</strong> {need.criterion}
                  </p>
                )}
                {need?.skipWhen && (
                  <p className="preparation-guidance">
                    <strong>미뤄도 될 때</strong> {need.skipWhen}
                  </p>
                )}
                {sharedEntries ? (
                  <p className="preparation-readonly">
                    {entry.status} · {entry.method} · {entry.quantity}개
                    {selected ? ` · ${displayTitle(selected)}` : ""}
                  </p>
                ) : (
                  <div className="preparation-fields">
                    <label>
                      상태
                      <select
                        value={entry.status}
                        onChange={(event) =>
                          change(entry.id, {
                            status: event.target.value as PreparationStatus,
                          })
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      마련 방법
                      <select
                        value={entry.method}
                        onChange={(event) =>
                          change(entry.id, {
                            method: event.target.value as PreparationMethod,
                          })
                        }
                      >
                        {methods.map((method) => (
                          <option key={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      준비 시점
                      <select
                        value={entry.stage}
                        onChange={(event) =>
                          change(entry.id, {
                            stage: event.target.value as Stage,
                          })
                        }
                      >
                        {stages.map((stage) => (
                          <option key={stage}>{stage}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      수량
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={entry.quantity}
                        onChange={(event) =>
                          change(entry.id, {
                            quantity: Math.max(
                              1,
                              Math.min(99, Number(event.target.value) || 1),
                            ),
                          })
                        }
                      />
                    </label>
                    {candidates.length > 0 && (
                      <label>
                        후보 제품
                        <select
                          value={entry.productId ?? ""}
                          onChange={(event) =>
                            change(entry.id, {
                              productId: event.target.value || null,
                            })
                          }
                        >
                          <option value="">아직 선택 안 함</option>
                          {candidates.map((item) => (
                            <option key={item.id} value={item.id}>
                              {displayTitle(item)} ·{" "}
                              {item.referencePrice ?? "기록가 없음"}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {(entry.method === "구매" || entry.method === "대여") && (
                      <>
                        <label>
                          예상 총비용 (원)
                          <input
                            type="number"
                            min="0"
                            max="100000000"
                            inputMode="numeric"
                            value={entry.expected ?? ""}
                            onChange={(event) =>
                              change(entry.id, {
                                expected:
                                  event.target.value === ""
                                    ? null
                                    : Math.max(
                                        0,
                                        Math.min(
                                          100_000_000,
                                          Math.floor(
                                            Number(event.target.value) || 0,
                                          ),
                                        ),
                                      ),
                              })
                            }
                            placeholder="미입력"
                          />
                        </label>
                        {entry.status === "준비 완료" && (
                          <label>
                            실제 총지출 (원)
                            <input
                              type="number"
                              min="0"
                              max="100000000"
                              inputMode="numeric"
                              value={entry.actual ?? ""}
                              onChange={(event) =>
                                change(entry.id, {
                                  actual:
                                    event.target.value === ""
                                      ? null
                                      : Math.max(
                                          0,
                                          Math.min(
                                            100_000_000,
                                            Math.floor(
                                              Number(event.target.value) || 0,
                                            ),
                                          ),
                                        ),
                                })
                              }
                              placeholder="미입력"
                            />
                          </label>
                        )}
                      </>
                    )}
                    <label className="preparation-note">
                      메모
                      <input
                        type="text"
                        maxLength={300}
                        value={entry.note}
                        onChange={(event) =>
                          change(entry.id, { note: event.target.value })
                        }
                        placeholder="사이즈, 선물 예정 등"
                      />
                    </label>
                  </div>
                )}
                {sharedEntries && entry.note && (
                  <p className="preparation-note-text">메모: {entry.note}</p>
                )}
                {selected && (
                  <button
                    className="preparation-product-link"
                    type="button"
                    onClick={() => onSelectProduct(selected)}
                  >
                    {displayTitle(selected)} 상세 보기
                  </button>
                )}
                {candidates.length > 1 && (
                  <p className="preparation-candidates">
                    후보 {candidates.length}개는 같은 품목으로 계산합니다.
                    기록가는 현재 판매가가 아닙니다.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!sharedEntries && (
        <>
          <details className="preparation-add">
            <summary>
              준비 품목 고르기 ·{" "}
              {needs.length -
                needs.filter((need) => existing.has(need.id)).length}
              개 남음
            </summary>
            {stages.map((stage) => (
              <div key={stage} className="preparation-add-group">
                <h3>{stage}</h3>
                <div>
                  {needs
                    .filter(
                      (need) => need.stage === stage && !existing.has(need.id),
                    )
                    .map((need) => (
                      <button
                        type="button"
                        key={need.id}
                        onClick={() => onAddNeed(need.id)}
                      >
                        + {need.title}
                      </button>
                    ))}
                </div>
              </div>
            ))}
            <div className="preparation-custom">
              <label htmlFor="custom-need">목록에 없는 품목</label>
              <input
                id="custom-need"
                value={customTitle}
                maxLength={60}
                onChange={(event) => setCustomTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addCustom();
                }}
                placeholder="직접 입력"
              />
              <button type="button" onClick={addCustom}>
                추가
              </button>
            </div>
          </details>
          {entries.length > 0 && (
            <div className="preparation-share">
              <button type="button" onClick={shareList}>
                현재 목록 공유
              </button>
              <p>
                공유 주소에는 품목·금액·메모가 포함됩니다. 받은 사람은 사본을
                저장할 수 있지만 변경 내용이 자동 동기화되지는 않습니다.
              </p>
              {shareUrl && (
                <label>
                  공유 주소
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(event) => event.target.select()}
                  />
                </label>
              )}
              <span role="status">{shareMessage}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
