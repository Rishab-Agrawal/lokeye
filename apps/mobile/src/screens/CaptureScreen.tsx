import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TASK_TYPE_CAPTURE_HINT, VIDEO_DURATION_SECONDS } from '@lokeye/shared';
import { useTaskStore } from '../store/tasks';
import { useToast } from '../hooks/useToast';
import { colors as C } from '../theme';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function CaptureScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Capture'>>();
  const insets = useSafeAreaInsets();
  const { taskId, taskType, taskTitle } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const { abandonTask } = useTaskStore();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const { toastMsg, showToast } = useToast();

  // Video recording state
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Progress animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progress = elapsedMs / (VIDEO_DURATION_SECONDS * 1000);

  // Clean up timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Animate progress ring
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 80,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const handleRecordVideo = async () => {
    if (!cameraRef.current || isRecording) return;
    setIsRecording(true);
    setElapsedMs(0);

    // Start countdown timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedMs(Math.min(elapsed, VIDEO_DURATION_SECONDS * 1000));
    }, 50);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: VIDEO_DURATION_SECONDS,
        codec: 'avc1',
      });
      if (video) {
        navigation.navigate('Submit', { taskId, mediaUri: video.uri, mediaType: 'video', taskTitle });
      }
    } catch (err) {
      showToast(t('capture.errorVideo'));
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
    }
  };

  const handleCancelTask = () => setShowCancelModal(true);

  const confirmCancelTask = async () => {
    setShowCancelModal(false);
    if (isRecording) cameraRef.current?.stopRecording();
    try {
      await abandonTask(taskId);
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })
      );
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const needsMic = taskType === 'video' && !micPermission?.granted;

  // Permission
  if (!permission?.granted || needsMic) {
    return (
      <View style={styles.center}>
        <View style={styles.permIcon}>
          <Ionicons name="camera-outline" size={36} color={C.slate400} />
        </View>
        <Text style={styles.permHeading}>{!permission?.granted ? t('capture.cameraNeeded') : t('capture.micNeeded')}</Text>
        <Text style={styles.permText}>
          {!permission?.granted
            ? t('capture.cameraReason')
            : t('capture.micReason')}
        </Text>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={!permission?.granted ? requestPermission : requestMicPermission}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('capture.grantPermission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      if (photo) navigation.navigate('Submit', { taskId, mediaUri: photo.uri, mediaType: 'photo', taskTitle });
    } catch (err) {
      showToast(t('capture.errorPhoto'));
    }
  };

  const hintText = TASK_TYPE_CAPTURE_HINT[taskType] ?? 'Capture your response';

  const remainSec = Math.max(0, Math.ceil((VIDEO_DURATION_SECONDS * 1000 - elapsedMs) / 1000));
  const actionText = taskType === 'photo'
    ? t('capture.tapCapture')
    : isRecording ? t('capture.recording', { seconds: remainSec }) : t('capture.tapRecord');

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={styles.camera}
        ref={cameraRef}
        mode={taskType === 'video' ? 'video' : 'picture'}
        {...(taskType === 'video' ? { videoQuality: '720p' } : {})}
      />

      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.hintText}>{hintText}</Text>
      </View>

      {/* Bottom overlay */}
      <View style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
        <Text style={styles.actionText}>{actionText}</Text>
        <View style={styles.captureRow}>
          <TouchableOpacity onPress={handleCancelTask} style={styles.cameraSideButton} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {taskType === 'photo' ? (
            <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto} activeOpacity={0.8}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.videoButtonOuter}
              onPress={handleRecordVideo}
              activeOpacity={0.8}
              disabled={isRecording}
            >
              <View style={styles.ringTrack} />
              {isRecording && (
                <Animated.View
                  style={[
                    styles.progressRingContainer,
                    {
                      transform: [{
                        rotate: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      }],
                    },
                  ]}
                />
              )}
              <View style={[styles.videoButtonInnerWrap, isRecording && styles.videoButtonRecording]}>
                {isRecording
                  ? <View style={styles.recordingSquare} />
                  : <View style={styles.videoStartCircle} />
                }
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.cameraSideButton} />
        </View>
      </View>

      {/* Cancel task modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>{t('capture.cancelTask')}</Text>
            <Text style={styles.modalMessage}>{t('capture.cancelMessage')}</Text>
            <TouchableOpacity
              style={styles.modalDestructiveButton}
              onPress={confirmCancelTask}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDestructiveText}>{t('capture.cancelConfirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalKeepButton}
              onPress={() => { setShowCancelModal(false); navigation.goBack(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalKeepText}>{t('capture.keepTask')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toastMsg && (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, 20) + 100 }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white, padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.white, padding: 32 },

  // Permission
  permIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.slate50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permHeading: { fontSize: 18, fontWeight: '700', color: C.slate900, marginBottom: 8 },
  permText: { color: C.slate500, fontSize: 14, marginBottom: 28, textAlign: 'center', lineHeight: 20 },

  submitButton: {
    backgroundColor: C.slate900,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.35 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hintText: { color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },

  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  cameraSideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Photo capture button
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 28,
  },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },

  // Video button with progress ring
  videoButtonOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 28,
  },
  ringTrack: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  progressRingContainer: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: '#EF4444',
    borderRightColor: '#EF4444',
  },
  videoButtonInnerWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoButtonRecording: {
    backgroundColor: 'rgba(239,68,68,0.6)',
  },
  videoStartCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  recordingSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // Cancel modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
  },
  modalIconWrap: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.slate900,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: C.slate500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalDestructiveButton: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalDestructiveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalKeepButton: {
    backgroundColor: C.slate50,
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
  },
  modalKeepText: {
    color: C.slate900,
    fontSize: 15,
    fontWeight: '600',
  },

  // Toast
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});

