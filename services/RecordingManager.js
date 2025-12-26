class RecordingManager {
  constructor(service) {
    this.service = service;
  }

  // Start server-side recording by emitting to socket and waiting for a response
  async startServerRecording(callId, timeoutMs = 10000) {
    if (!this.service || !this.service.socket) {
      return { success: false, error: 'no-socket', retryable: false };
    }

    console.log('[RecordingManager] requesting server start-recording for', callId);
    
    return new Promise((resolve) => {
      const socket = this.service.socket;
      const cleanup = () => {
        socket.off('recording-started', onStarted);
        socket.off('recording-failed', onFailed);
      };
    
      const t = setTimeout(() => {
        cleanup();
        console.warn('[RecordingManager] startServerRecording timed out');
        resolve({ success: false, error: 'timeout', retryable: true });
      }, timeoutMs);
    
      const onStarted = (data) => {
        clearTimeout(t);
        cleanup();
        console.log('[RecordingManager] server recording confirmed started:', data);
        resolve({ success: true, recording: data.recording || data });
      };
    
      const onFailed = (data) => {
        clearTimeout(t);
        cleanup();
        console.warn('[RecordingManager] server recording failed:', data);
        resolve({ success: false, error: data && data.error ? data.error : 'failed', retryable: !!(data && data.retryable), fileName: data && data.fileName, filePath: data && data.filePath });
      };
    
      socket.once('recording-started', onStarted);
      socket.once('recording-failed', onFailed);
    
      socket.emit('start-recording', { callId });
    });
  }

  // Stop server-side recording; waits for recording-stopped/recording-failed
  async stopServerRecording(callId, timeoutMs = 10000) {
    if (!this.service || !this.service.socket) {
      return { success: false, error: 'no-socket' };
    }

    console.log('[RecordingManager] requesting server stop-recording for', callId);

    return new Promise((resolve) => {
      const socket = this.service.socket;
      const cleanup = () => {
        socket.off('recording-stopped', onStopped);
        socket.off('recording-failed', onFailed);
      };

      const t = setTimeout(() => {
        cleanup();
        console.warn('[RecordingManager] stopServerRecording timed out');
        resolve({ success: false, error: 'timeout' });
      }, timeoutMs);

      const onStopped = (data) => {
        clearTimeout(t);
        cleanup();
        console.log('[RecordingManager] server recording stopped:', data);
        resolve({ success: true, downloadUrl: data && data.downloadUrl, fileName: data && data.fileName, filePath: data && data.filePath, duration: data && data.duration });
      };

      const onFailed = (data) => {
        clearTimeout(t);
        cleanup();
        console.warn('[RecordingManager] server recording failed during stop:', data);
        resolve({ success: false, error: data && data.error ? data.error : 'failed', fileName: data && data.fileName, filePath: data && data.filePath });
      };

      socket.once('recording-stopped', onStopped);
      socket.once('recording-failed', onFailed);

      socket.emit('stop-recording', { callId });
    });
  }

  // Query server recording status via debug-status (returns server-side status and router caps)
  async getServerRecordingStatus(callId, timeoutMs = 5000) {
    if (!this.service || !this.service.socket) {
      return { success: false, error: 'no-socket' };
    }

    console.log('[RecordingManager] requesting debug-status for', callId);

    return new Promise((resolve) => {
      const socket = this.service.socket;
      let finished = false;

      const cleanup = () => {
        socket.off('debug-status-response', onResp);
      };

      const t = setTimeout(() => {
        if (!finished) {
          finished = true;
          cleanup();
          console.warn('[RecordingManager] getServerRecordingStatus timed out');
          resolve({ success: false, error: 'timeout' });
        }
      }, timeoutMs);

      const onResp = (data) => {
        if (!finished) {
          finished = true;
          clearTimeout(t);
          cleanup();
          console.log('[RecordingManager] debug-status response:', data);
          if (data && data.error) {
            resolve({ success: false, error: data.error });
          } else {
            resolve({ success: true, status: data.status });
          }
        }
      };

      socket.once('debug-status-response', onResp);
      socket.emit('debug-status', { callId });
    });
  }

  // Handle server recording started (optional)
  handleServerRecordingStarted(data) {
    console.log('[RecordingManager] server recording started:', data);
    return data;
  }

  // Handle server recording stopped
  handleServerRecordingStopped(data) {
    console.log('[RecordingManager] server recording stopped:', data);
    if (data && (data.fileName || data.filePath || data.downloadUrl)) {
      console.log(`[RecordingManager] saved file: file=${data.fileName || ''} path=${data.filePath || ''} downloadUrl=${data.downloadUrl || ''}`);
    }
    return data;
  }

  // Handle server recording errors (possibly with partial file info)
  handleServerRecordingError(data) {
    console.warn('[RecordingManager] server recording error:', data);
    if (data && (data.fileName || data.filePath)) {
      console.warn(`[RecordingManager] partial file: file=${data.fileName || ''} path=${data.filePath || ''}`);
    }
    return data;
  }
}

export default RecordingManager;
