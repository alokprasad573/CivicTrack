"use client";

import React from "react";
import {
  ManeuverType,
  NavigationState,
  NavigationStep,
} from "@civictrack/contracts";
import {
  formatDistance,
  formatDuration,
  formatEta,
} from "../../../lib/navigation-service";
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  Flag,
  Navigation,
  Play,
  Pause,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
} from "lucide-react";

export interface NavigationPanelProps {
  state: NavigationState;
  currentStep: NavigationStep | null;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  isVoiceMuted: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onToggleVoice: () => void;
}

function getManeuverIcon(maneuver?: ManeuverType) {
  switch (maneuver) {
    case "turn-left":
      return <CornerUpLeft className="w-8 h-8 text-primary" />;
    case "turn-right":
      return <CornerUpRight className="w-8 h-8 text-primary" />;
    case "turn-slight-left":
      return <ArrowUpLeft className="w-8 h-8 text-primary" />;
    case "turn-slight-right":
      return <ArrowUpRight className="w-8 h-8 text-primary" />;
    case "turn-sharp-left":
      return <ArrowLeft className="w-8 h-8 text-primary" />;
    case "turn-sharp-right":
      return <ArrowRight className="w-8 h-8 text-primary" />;
    case "u-turn":
      return <RotateCcw className="w-8 h-8 text-primary" />;
    case "arrive":
      return <Flag className="w-8 h-8 text-emerald-400" />;
    case "depart":
    case "continue":
    default:
      return <ArrowUp className="w-8 h-8 text-primary" />;
  }
}

export function NavigationPanel({
  state,
  currentStep,
  remainingDistanceMeters,
  remainingDurationSeconds,
  isVoiceMuted,
  onStart,
  onPause,
  onResume,
  onStop,
  onToggleVoice,
}: NavigationPanelProps) {
  if (state === NavigationState.IDLE) {
    return null;
  }

  const isNavigating = state === NavigationState.NAVIGATING;
  const isPaused = state === NavigationState.PAUSED;
  const isRerouting = state === NavigationState.REROUTING;
  const isArrived = state === NavigationState.ARRIVED;
  const isReady = state === NavigationState.ROUTE_READY;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-20">
      {/* Top HUD: Next Maneuver & Road Name */}
      <div className="w-full max-w-md mx-auto pointer-events-auto">
        <div className="bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              {isRerouting ? (
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              ) : (
                getManeuverIcon(currentStep?.maneuver)
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {isRerouting
                    ? "Rerouting..."
                    : currentStep
                    ? formatDistance(currentStep.distanceMeters)
                    : "Next Turn"}
                </span>
                {currentStep?.roadName && (
                  <span className="text-xs text-muted-foreground truncate">
                    • {currentStep.roadName}
                  </span>
                )}
              </div>

              <h3 className="text-sm font-semibold text-foreground leading-snug truncate mt-0.5">
                {isRerouting
                  ? "Recalculating best route to destination"
                  : isArrived
                  ? "You have arrived at the complaint location"
                  : currentStep?.instruction || "Proceed along route"}
              </h3>
            </div>
          </div>

          {/* Voice Mute Toggle */}
          <button
            type="button"
            onClick={onToggleVoice}
            title={isVoiceMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
            className="p-2 rounded-lg bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {isVoiceMuted ? (
              <VolumeX className="w-5 h-5 text-destructive" />
            ) : (
              <Volume2 className="w-5 h-5 text-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom HUD: Distance, ETA, Controls */}
      <div className="w-full max-w-md mx-auto pointer-events-auto">
        <div className="bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-primary">
                  {formatDistance(remainingDistanceMeters)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({formatDuration(remainingDurationSeconds)})
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Estimated Arrival:{" "}
                <span className="font-medium text-foreground">
                  {formatEta(remainingDurationSeconds)}
                </span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {isReady && (
                <button
                  type="button"
                  onClick={onStart}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg hover:bg-primary/90 transition-all"
                >
                  <Navigation className="w-4 h-4 fill-primary-foreground" />
                  <span>Start Navigation</span>
                </button>
              )}

              {isNavigating && (
                <button
                  type="button"
                  onClick={onPause}
                  className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                  title="Pause Navigation"
                >
                  <Pause className="w-5 h-5" />
                </button>
              )}

              {isPaused && (
                <button
                  type="button"
                  onClick={onResume}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground transition-colors"
                  title="Resume Navigation"
                >
                  <Play className="w-5 h-5 fill-primary-foreground" />
                </button>
              )}

              <button
                type="button"
                onClick={onStop}
                className="p-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                title="End Navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Safety Notice */}
          <p className="text-[10px] text-muted-foreground/70 text-center border-t border-border/40 pt-2">
            ⚠️ Driver assistance guidance only. Always follow municipal traffic regulations and road conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
