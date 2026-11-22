"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Coordinates,
  NavigationState,
  NavigationStep,
  RouteCalculationResult,
} from "@civictrack/contracts";
import { useGeolocation } from "./use-geolocation";
import {
  calculateRoute,
  calculateDistanceMeters,
  distanceToRouteMeters,
} from "../lib/navigation-service";

export interface NavigationHookReturn {
  state: NavigationState;
  route: RouteCalculationResult | null;
  currentStep: NavigationStep | null;
  currentStepIndex: number;
  remainingDistanceMeters: number;
  remainingDurationSeconds: number;
  currentGps: Coordinates | null;
  gpsAccuracy: number | null;
  gpsHeading: number | null;
  isVoiceMuted: boolean;
  errorMessage: string | null;
  requestRoute: (destination: Coordinates) => Promise<void>;
  startNavigation: () => void;
  pauseNavigation: () => void;
  resumeNavigation: () => void;
  stopNavigation: () => void;
  toggleVoice: () => void;
}

export function useNavigation(): NavigationHookReturn {
  const [navState, setNavState] = useState<NavigationState>(NavigationState.IDLE);
  const [route, setRoute] = useState<RouteCalculationResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remainingDistance, setRemainingDistance] = useState(0);
  const [remainingDuration, setRemainingDuration] = useState(0);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const destinationRef = useRef<Coordinates | null>(null);
  const lastSpokenStepIndexRef = useRef<number>(-1);
  const lastRerouteTimeRef = useRef<number>(0);

  const {
    coords: currentGps,
    accuracy: gpsAccuracy,
    heading: gpsHeading,
    isTracking,
    startTracking,
    stopTracking,
    getCurrentPosition,
  } = useGeolocation();

  // Voice announcements using Web Speech API
  const speakInstruction = useCallback(
    (text: string) => {
      if (isVoiceMuted || typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      window.speechSynthesis.cancel(); // Stop overlapping speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = "en-IN"; // Indian English voice where available
      window.speechSynthesis.speak(utterance);
    },
    [isVoiceMuted]
  );

  // Request new route
  const requestRoute = useCallback(
    async (destination: Coordinates) => {
      destinationRef.current = destination;
      setNavState(NavigationState.ROUTE_LOADING);
      setErrorMessage(null);

      try {
        let origin: Coordinates;
        if (currentGps) {
          origin = currentGps;
        } else {
          origin = await getCurrentPosition();
        }

        const calculatedRoute = await calculateRoute(origin, destination);
        setRoute(calculatedRoute);
        setCurrentStepIndex(0);
        setRemainingDistance(calculatedRoute.distanceMeters);
        setRemainingDuration(calculatedRoute.durationSeconds);
        setNavState(NavigationState.ROUTE_READY);

        // Speak initial route ready summary
        const firstStep = calculatedRoute.steps[0];
        if (firstStep) {
          speakInstruction(`Route calculated. ${firstStep.instruction}`);
          lastSpokenStepIndexRef.current = 0;
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to calculate navigation route");
        setNavState(NavigationState.ERROR);
      }
    },
    [currentGps, getCurrentPosition, speakInstruction]
  );

  // Start active navigation
  const startNavigation = useCallback(() => {
    if (navState !== NavigationState.ROUTE_READY && navState !== NavigationState.PAUSED) {
      return;
    }

    startTracking();
    setNavState(NavigationState.NAVIGATING);

    if (route && route.steps[currentStepIndex]) {
      speakInstruction(`Starting navigation. ${route.steps[currentStepIndex]!.instruction}`);
    }
  }, [navState, route, currentStepIndex, startTracking, speakInstruction]);

  // Pause navigation
  const pauseNavigation = useCallback(() => {
    if (navState === NavigationState.NAVIGATING) {
      setNavState(NavigationState.PAUSED);
      speakInstruction("Navigation paused");
    }
  }, [navState, speakInstruction]);

  // Resume navigation
  const resumeNavigation = useCallback(() => {
    if (navState === NavigationState.PAUSED) {
      setNavState(NavigationState.NAVIGATING);
      speakInstruction("Resuming navigation");
    }
  }, [navState, speakInstruction]);

  // Stop navigation
  const stopNavigation = useCallback(() => {
    stopTracking();
    setNavState(NavigationState.IDLE);
    setRoute(null);
    setCurrentStepIndex(0);
    destinationRef.current = null;
    lastSpokenStepIndexRef.current = -1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [stopTracking]);

  const toggleVoice = useCallback(() => {
    setIsVoiceMuted((prev) => !prev);
  }, []);

  // Active navigation tracking, step progression, and rerouting
  useEffect(() => {
    if (navState !== NavigationState.NAVIGATING || !currentGps || !route || !destinationRef.current) {
      return;
    }

    const destination = destinationRef.current;
    const distanceToDestination = calculateDistanceMeters(currentGps, destination);

    // 1. Arrival Check (within 25m of destination)
    if (distanceToDestination <= 25) {
      setNavState(NavigationState.ARRIVED);
      speakInstruction("You have arrived at your destination.");
      return;
    }

    // 2. Off-Route & Automatic Rerouting Detection
    const deviationMeters = distanceToRouteMeters(currentGps, route.geometry.coordinates);
    const now = Date.now();

    // Reroute if deviated > 50 meters and accuracy is reasonable (< 30m) and cooldown (10s) passed
    if (
      deviationMeters > 50 &&
      (gpsAccuracy === null || gpsAccuracy < 35) &&
      now - lastRerouteTimeRef.current > 10000
    ) {
      lastRerouteTimeRef.current = now;
      setNavState(NavigationState.REROUTING);
      speakInstruction("Rerouting, calculating new path");

      calculateRoute(currentGps, destination)
        .then((newRoute) => {
          setRoute(newRoute);
          setCurrentStepIndex(0);
          setRemainingDistance(newRoute.distanceMeters);
          setRemainingDuration(newRoute.durationSeconds);
          setNavState(NavigationState.NAVIGATING);
          const firstStep = newRoute.steps[0];
          if (firstStep) {
            speakInstruction(`Route updated. ${firstStep.instruction}`);
            lastSpokenStepIndexRef.current = 0;
          }
        })
        .catch(() => {
          // If recalculation fails, continue with current route
          setNavState(NavigationState.NAVIGATING);
        });
      return;
    }

    // 3. Step Progression
    const currentStep = route.steps[currentStepIndex];
    if (currentStep) {
      const distanceToManeuver = calculateDistanceMeters(currentGps, currentStep.location);

      // Advance to next step if user is close (< 30m) to this maneuver point
      if (distanceToManeuver <= 30 && currentStepIndex < route.steps.length - 1) {
        const nextIndex = currentStepIndex + 1;
        setCurrentStepIndex(nextIndex);
        const nextStep = route.steps[nextIndex];
        if (nextStep && lastSpokenStepIndexRef.current !== nextIndex) {
          speakInstruction(nextStep.instruction);
          lastSpokenStepIndexRef.current = nextIndex;
        }
      }
    }

    // 4. Update Remaining Distance & Duration
    setRemainingDistance(distanceToDestination);
    setRemainingDuration(Math.max(30, Math.round(distanceToDestination / 8.33)));
  }, [
    navState,
    currentGps,
    gpsAccuracy,
    route,
    currentStepIndex,
    speakInstruction,
  ]);

  const currentStep = route?.steps[currentStepIndex] || null;

  return {
    state: navState,
    route,
    currentStep,
    currentStepIndex,
    remainingDistanceMeters: remainingDistance,
    remainingDurationSeconds: remainingDuration,
    currentGps,
    gpsAccuracy,
    gpsHeading,
    isVoiceMuted,
    errorMessage,
    requestRoute,
    startNavigation,
    pauseNavigation,
    resumeNavigation,
    stopNavigation,
    toggleVoice,
  };
}
