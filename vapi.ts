import DailyIframe, {
  DailyCall,
  DailyEventObjectActiveSpeakerChange,
  DailyEventObjectRemoteParticipantsAudioLevel,
} from "@daily-co/daily-js";

import { CreateAssistantDTO } from "./api";
import EventEmitter from "events";
import { client } from "./client";

export default class Vapi extends EventEmitter {
  private started: boolean = false;
  private call: DailyCall | null = null;
  private speakingTimeout: NodeJS.Timeout | null = null;

  constructor(apiToken: string, apiBaseUrl?: string) {
    super();
    client.baseUrl = apiBaseUrl ?? "https://api.vapi.ai";
    client.setSecurityData(apiToken);
  }

  start(assistant: CreateAssistantDTO | string): void {
    if (this.started) {
      return;
    }

    this.started = true;

    client.call
      .callControllerCreateWebCall({
        assistant: typeof assistant === "string" ? undefined : assistant,
        assistantId: typeof assistant === "string" ? assistant : undefined,
      })
      .then(async ({ data }) => {
        const { url } = data;

        this.call = DailyIframe.createFrame({
          audioSource: true,
          videoSource: false,
        });
        this.call.iframe()?.style.setProperty("display", "none");
        await this.call.join({ url });

        this.call.startRemoteParticipantsAudioLevelObserver();
        this.call.on("remote-participants-audio-level", (e) =>
          this.handleRemoteParticipantsAudioLevel(e)
        );
      })
      .catch((error) => {
        console.error(error);
      });
  }

  private handleRemoteParticipantsAudioLevel(
    e: DailyEventObjectRemoteParticipantsAudioLevel
  ) {
    const isSpeaking = Object.values(e.participantsAudioLevel).some(
      (v) => v > 0.01
    );
    if (!isSpeaking) return;

    if (this.speakingTimeout) {
      clearTimeout(this.speakingTimeout);
    } else {
      this.emit("speech-start");
    }

    this.speakingTimeout = setTimeout(() => {
      this.emit("speech-end");
    }, 500);
  }

  stop(): void {
    this.started = false;
    this.call?.destroy();
    this.call = null;
  }
}
