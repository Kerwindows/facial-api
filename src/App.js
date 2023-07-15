import * as faceapi from 'face-api.js';
import React from 'react';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import { css } from '@emotion/react';
import PulseLoader from 'react-spinners/PulseLoader';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogTitle from '@material-ui/core/DialogTitle';
import { comparisonImageUrls } from './facialRecognitionArray';

const override = css`
  display: block;
  margin: 0 auto;
  border-color: red;
`;

function App() {
  const [modelsLoaded, setModelsLoaded] = React.useState(false);
  const [captureVideo, setCaptureVideo] = React.useState(false);
  const [detectionRunning, setDetectionRunning] = React.useState(false);
  const [faceDetected, setFaceDetected] = React.useState(false);
  const [detectedUserName, setDetectedUserName] = React.useState('');
  const [canvasContext, setCanvasContext] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [labeledFaceDescriptors, setLabeledFaceDescriptors] = React.useState(
    [],
  );

  const videoRef = React.useRef();
  const videoHeight = 480;
  const videoWidth = 640;
  const canvasRef = React.useRef();

  React.useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = process.env.PUBLIC_URL + '/models';

      Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      ]).then(() => {
        setModelsLoaded(true);
        console.log('Models loaded successfully.');
      });
    };
    loadModels();
  }, []);

  React.useEffect(() => {
    if (captureVideo && videoRef.current && canvasRef.current && modelsLoaded) {
      handleVideoOnPlay();
    }
  }, [captureVideo, videoRef.current, canvasRef.current, modelsLoaded]);

  const startVideo = () => {
    setCaptureVideo(true);

    navigator.mediaDevices
      .getUserMedia({ video: { width: 300 } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            // Set the canvas size when video metadata is loaded
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          };
        }
      })
      .catch((err) => {
        console.error('error:', err);
      });
  };

  const handleVideoOnPlay = async () => {
    if (
      canvasRef &&
      canvasRef.current &&
      videoRef &&
      videoRef.current &&
      videoRef.current.readyState === 4 &&
      !detectionRunning
    ) {
      setDetectionRunning(true);
      const displaySize = { width: videoWidth, height: videoHeight };
      faceapi.matchDimensions(canvasRef.current, displaySize);

      const labeledFaceDescriptors =
        await loadComparisonImagesAndComputeDescriptors();

      const intervalId = setInterval(async () => {
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions(),
          )
          .withFaceLandmarks()
          .withFaceExpressions()
          .withFaceDescriptors(); // Compute face descriptors

        console.log('Detected faces:', detections);

        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize,
        );

        const canvasContext = canvasRef.current.getContext('2d');
        canvasContext.clearRect(0, 0, videoWidth, videoHeight);

        if (!faceDetected) {
          // Do not draw anything if a face has been detected
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceExpressions(
            canvasRef.current,
            resizedDetections,
          );
        }

        if (labeledFaceDescriptors.length > 0) {
          // console.log('Have labeled face descriptors:', labeledFaceDescriptors);
          const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);
          const results = resizedDetections.map((d) =>
            faceMatcher.findBestMatch(d.descriptor),
          );

          for (let i = 0; i < results.length; i++) {
            const bestMatch = results[i];
            // console.log('Best match:', bestMatch.toString());
            console.log(bestMatch.label);
            // console.log(bestMatch);

            if (canvasRef && canvasRef.current) {
              if (bestMatch.label && bestMatch.label !== 'unknown') {
                // Get the descriptor that matches the label
                const matchedDescriptor = labeledFaceDescriptors.find(
                  (descriptor) => descriptor.label === bestMatch.label,
                );
                const [label, id] = matchedDescriptor.label.split('__');
                console.log('User ID:', id); // Output the user ID

                setFaceDetected(true);
                setDetectedUserName(bestMatch.label);
                clearInterval(intervalId); // Clear the interval after successful detection
                setOpen(true); // This will open the Dialog box after successful completion
              }
            }
          }
        } else {
          console.log('No labeled face descriptors.');
        }
      }, 1000);
    }
  };

  const loadComparisonImagesAndComputeDescriptors = async () => {
    if (labeledFaceDescriptors.length === 0) {
      // Check if we have cached descriptors
      const labeledFaceDescriptors = Promise.all(
        comparisonImageUrls.map(async (image) => {
          const img = await faceapi.fetchImage(image.url);
          const detections = await faceapi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detections) {
            return new faceapi.LabeledFaceDescriptors(
              `${image.label}__${image.id}`,
              [detections.descriptor],
            );
          }
          return null;
        }),
      );

      const results = await labeledFaceDescriptors;
      setLabeledFaceDescriptors(results); // Cache the results
      return results;
    } else {
      return labeledFaceDescriptors; // Return cached results
    }
  };

  const closeWebcam = () => {
    videoRef.current.pause();
    videoRef.current.srcObject.getTracks()[0].stop();
    setCaptureVideo(false);
    setDetectionRunning(false);
    setFaceDetected(false);
    setDetectedUserName('');
    if (canvasContext) {
      canvasContext.clearRect(0, 0, videoWidth, videoHeight);
    }
  };

  const restartDetection = () => {
    setDetectionRunning(false);
    setFaceDetected(false);
    setDetectedUserName('');
    if (canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      // if (context) {
      //   context.clearRect(0, 0, videoWidth, videoHeight);
      // }
      context.clearRect(0, 0, videoWidth, videoHeight);
    }
    handleVideoOnPlay();
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      {captureVideo && modelsLoaded ? (
        <>
          <Button variant="contained" color="secondary" onClick={closeWebcam}>
            Close Webcam
          </Button>
          <br />
          <br />
          {captureVideo && !detectionRunning && !faceDetected && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleVideoOnPlay}
            >
              Start Detection
            </Button>
          )}
          {detectionRunning && !faceDetected && (
            <PulseLoader
              color={'#123abc'}
              loading={true}
              css={override}
              size={15}
            />
          )}
        </>
      ) : (
        <Button variant="contained" color="primary" onClick={startVideo}>
          Open Webcam
        </Button>
      )}

      {captureVideo ? (
        modelsLoaded ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '10px',
                position: 'relative',
              }}
            >
              <video
                ref={videoRef}
                height={videoHeight}
                width={videoWidth}
                style={{ borderRadius: '10px' }}
              />
              {faceDetected && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '25px',
                  }}
                >
                  Complete
                </div>
              )}
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  borderRadius: '10px',
                }}
              />
            </div>
            {faceDetected && (
              <>
                <Dialog
                  open={open}
                  onClose={restartDetection}
                  aria-labelledby="alert-dialog-title"
                  aria-describedby="alert-dialog-description"
                >
                  <DialogTitle id="alert-dialog-title">
                    {'Welcome ' + detectedUserName.split('__')[0] + '!'}
                  </DialogTitle>
                  <DialogActions>
                    <Button
                      onClick={restartDetection}
                      color="primary"
                      autoFocus
                    >
                      Close
                    </Button>
                  </DialogActions>
                </Dialog>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginTop: '10px' }}>
            <CircularProgress />
          </div>
        )
      ) : (
        <></>
      )}
    </div>
  );
}

export default App;
