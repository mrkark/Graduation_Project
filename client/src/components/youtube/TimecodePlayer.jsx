import { forwardRef, useImperativeHandle, useRef } from 'react';
import YouTube from 'react-youtube';

// Обёртка над react-youtube с проброшенным ref для внешнего управления
// (seekTo/playVideo/pauseVideo) — используется при клике по движению в дереве ката.
const TimecodePlayer = forwardRef(function TimecodePlayer({ videoId, onReady }, ref) {
  const playerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      playerRef.current?.seekTo(seconds, true);
      playerRef.current?.playVideo();
    },
    play() {
      playerRef.current?.playVideo();
    },
    pause() {
      playerRef.current?.pauseVideo();
    },
  }));

  if (!videoId) {
    return <div className="video-placeholder">Видео не добавлено</div>;
  }

  return (
    <div className="video-wrapper">
      <YouTube
        videoId={videoId}
        opts={{ width: '100%', height: '100%', playerVars: { rel: 0 } }}
        onReady={(e) => {
          playerRef.current = e.target;
          onReady?.(e.target);
        }}
        className="video-iframe-holder"
        iframeClassName="video-iframe"
      />
    </div>
  );
});

export default TimecodePlayer;
