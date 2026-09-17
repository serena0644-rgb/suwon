"use client";

import { formatDistance, formatDuration } from "@/lib/routing/geo";
import type { NavigationProgress } from "@/lib/routing/navigation";
import type { GeolocationState } from "@/lib/routing/use-geolocation";
import type { WalkRoute } from "@/lib/routing/types";
import { stepIcon } from "./route-map";

type GuidancePanelProps = {
  geo: GeolocationState;
  onExit: () => void;
  onRetry: () => void;
  progress: NavigationProgress | null;
  rerouting: boolean;
  route: WalkRoute;
};

export function GuidancePanel({ geo, onExit, onRetry, progress, rerouting, route }: GuidancePanelProps) {
  const blocked = geo.status === "denied" || geo.status === "unsupported" || geo.status === "error";

  return (
    <section className="guidance-panel" aria-label="실시간 경로 안내">
      <header className="guidance-head">
        <div>
          <span className="badge soft">실시간 안내</span>
          <h3>{progress?.arrived ? "목적지에 도착했습니다" : "경로를 따라 이동 중"}</h3>
        </div>
        <button className="small-btn danger" type="button" onClick={onExit}>
          안내 종료
        </button>
      </header>

      {blocked && (
        <div className="guidance-alert" role="alert">
          <strong>현재 위치를 사용할 수 없습니다</strong>
          <p>{geo.error}</p>
          <p className="muted">
            위치 없이도 아래 안내 순서와 지도를 보고 이동할 수 있습니다. 권한을 허용한 뒤 다시 시도해 주세요.
          </p>
          <button className="small-btn primary" type="button" onClick={onRetry}>
            위치 권한 다시 시도
          </button>
        </div>
      )}

      {!blocked && geo.status === "locating" && (
        <p className="guidance-status" role="status">
          현재 위치를 확인하는 중입니다…
        </p>
      )}

      {rerouting && (
        <p className="guidance-status is-warn" role="status">
          경로를 벗어나 현재 위치에서 다시 탐색하고 있습니다…
        </p>
      )}

      {!rerouting && progress?.offRoute && !progress.arrived && (
        <p className="guidance-status is-warn" role="status">
          경로에서 약 {formatDistance(progress.distanceFromPath)} 벗어났습니다. 계속 벗어나면 자동으로 다시 탐색합니다.
        </p>
      )}

      {progress && !progress.arrived && progress.nextStep && (
        <div className={`guidance-next guidance-next-${progress.nextStep.kind}`}>
          <span className="guidance-icon" aria-hidden="true">
            {stepIcon(progress.nextStep.kind)}
          </span>
          <div>
            <strong>{progress.nextStep.description}</strong>
            <p>{formatDistance(progress.distanceToNextStep)} 앞</p>
            {progress.nextStep.warning && <p className="guidance-warning">{progress.nextStep.warning}</p>}
          </div>
        </div>
      )}

      {progress?.upcomingStep && !progress.arrived && (
        <p className="guidance-upcoming">
          그다음 · {stepIcon(progress.upcomingStep.kind)} {progress.upcomingStep.description}
        </p>
      )}

      <dl className="guidance-stats">
        <div>
          <dt>남은 거리</dt>
          <dd>{formatDistance(progress ? progress.remainingDistance : route.distance)}</dd>
        </div>
        <div>
          <dt>남은 시간</dt>
          <dd>{formatDuration(progress ? progress.remainingDuration : route.duration)}</dd>
        </div>
        <div>
          <dt>현재 구간</dt>
          <dd>
            {progress ? progress.legIndex + 1 : 1} / {route.legs.length}
          </dd>
        </div>
      </dl>

      {progress && (
        <div className="guidance-progress" aria-hidden="true">
          <span style={{ width: `${progressPercent(progress, route)}%` }} />
        </div>
      )}

      <ol className="guidance-steps">
        {route.steps.map((step, index) => {
          const passed = progress ? step.distance <= progress.traveled : false;
          const current = progress?.nextStep === step;
          return (
            <li
              className={`${passed ? "is-passed" : ""} ${current ? "is-current" : ""}`.trim()}
              key={`${step.legIndex}-${index}-${step.distance}`}
            >
              <span aria-hidden="true">{stepIcon(step.kind)}</span>
              <div>
                <p>{step.description}</p>
                {step.warning && <small className="guidance-warning">{step.warning}</small>}
              </div>
              <strong>{formatDistance(step.distance)}</strong>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function progressPercent(progress: NavigationProgress, route: WalkRoute) {
  const total = route.distance || 1;
  return Math.min(100, Math.max(0, (progress.traveled / total) * 100));
}
