import { useState, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { useTaskStore } from '../store/tasks';
import { getAccessToken } from '../services/authToken';
import { useAuthStore } from '../store/auth';
import { useToast } from '../hooks/useToast';
import { colors as C } from '../theme';
import { RootStackParamList } from '../navigation';

export default function SubmitScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Submit'>>();
  const insets = useSafeAreaInsets();
  const { taskId, mediaUri, mediaType, taskTitle } = route.params;
  const [uploading, setUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toastMsg, showToast } = useToast();
  const { submitTask } = useTaskStore();

  // Video playback
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const handleSubmit = async () => {
    setUploading(true);
    try {
      let mediaUrls: string[] = [];

      if (mediaUri) {
        const ext = mediaType === 'photo' ? 'jpg' : 'mp4';
        const contentType = mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

        const token = await getAccessToken();
        if (!token) throw new Error('Not authenticated');

        const formData = new FormData();
        formData.append('file', {
          uri: mediaUri,
          name: `media.${ext}`,
          type: contentType,
        } as any);

        const uploadResponse = await fetch(`${apiUrl}/api/v1/human/media/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const uploadData = await uploadResponse.json().catch(() => ({}));
          throw new Error((uploadData as any).error || 'Upload failed');
        }

        const { publicUrl } = await uploadResponse.json();
        mediaUrls = [publicUrl];
      }

      await submitTask(taskId, {
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      });

      setShowSuccess(true);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Task context */}
      {taskTitle ? (
        <View style={styles.contextHeader}>
          <Text style={styles.contextLabel}>{t('submit.submittingFor')}</Text>
          <Text style={styles.contextTitle} numberOfLines={1}>{taskTitle}</Text>
        </View>
      ) : null}

      {/* Preview */}
      <View style={styles.previewSection}>
        {mediaUri && mediaType === 'photo' && (
          <View style={styles.previewWrapper}>
            <Image source={{ uri: mediaUri }} style={styles.preview} resizeMode="cover" />
          </View>
        )}

        {mediaUri && mediaType === 'video' && (
          <View style={styles.previewWrapper}>
            <Video
              ref={videoRef}
              source={{ uri: mediaUri }}
              style={styles.videoPreview}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isLooping={false}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                  setIsPlaying(status.isPlaying);
                  if (status.didJustFinish) setIsPlaying(false);
                }
              }}
            />
            <TouchableOpacity
              style={styles.videoOverlay}
              onPress={handlePlayPause}
              activeOpacity={0.8}
            >
              {!isPlaying && (
                <View style={styles.playButton}>
                  <Ionicons name="play" size={32} color="#fff" style={{ marginLeft: 3 }} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!mediaUri && (
          <View style={styles.mediaPlaceholder}>
            <Ionicons name="document-text-outline" size={32} color={C.slate400} />
            <Text style={styles.mediaLabel}>{t('submit.textResponse')}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoNote}>
        <Ionicons name="information-circle-outline" size={16} color={C.slate400} style={{ marginRight: 8 }} />
        <Text style={styles.infoText}>
          {t('submit.paymentNote')}
        </Text>
      </View>

      {/* Bottom actions */}
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.disabled]}
          onPress={handleSubmit}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <View style={styles.uploadRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>  {t('submit.uploading')}</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>{t('submit.submitResponse')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.retakeButton}
          onPress={() => navigation.goBack()}
          disabled={uploading}
        >
          <Text style={[styles.retakeText, uploading && { opacity: 0.3 }]}>{t('submit.retake')}</Text>
        </TouchableOpacity>
      </View>

      {/* Toast */}
      {toastMsg && (
        <View style={[styles.toast, { bottom: Math.max(insets.bottom, 12) + 70 }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      {/* Success modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
            </View>
            <Text style={styles.modalTitle}>{t('submit.submitted')}</Text>
            <Text style={styles.modalMessage}>{t('submit.submittedMessage')}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              activeOpacity={0.85}
              onPress={() => {
                setShowSuccess(false);
                navigation.dispatch(
                  CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })
                );
              }}
            >
              <Text style={styles.modalButtonText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.white },

  contextHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.slate100,
  },
  contextLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.indigo500,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  contextTitle: { fontSize: 16, fontWeight: '600', color: C.slate900 },

  previewSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    justifyContent: 'center',
  },
  previewWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: C.slate50,
  },
  preview: { width: '100%', height: 340 },
  videoPreview: { width: '100%', height: 340 },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mediaPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 24,
    backgroundColor: C.slate50,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  mediaLabel: { color: C.slate500, fontSize: 15 },

  infoNote: {
    marginHorizontal: 24,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.slate50,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  infoText: { fontSize: 13, color: C.slate500, lineHeight: 18, flex: 1 },

  bottomActions: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.slate100,
  },
  submitButton: {
    backgroundColor: C.slate900,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  uploadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  retakeButton: { paddingVertical: 14, alignItems: 'center' },
  retakeText: { color: C.slate500, fontSize: 14, fontWeight: '600' },

  // Success modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.neutral900,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: C.neutral500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: C.neutral900,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Toast
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: C.slate900,
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
