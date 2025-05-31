import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Switch,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../constants/theme';

interface TeamInfo {
  id: string;
  name: string;
}

interface PostCreationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { title?: string; content: string; is_general: boolean; team_ids: string[] }) => Promise<void>;
  availableTeams: TeamInfo[];
  isAdmin?: boolean;
  isCoach?: boolean;
  initialTitle?: string;
  initialContent?: string;
  initialIsGeneral?: boolean;
  initialTeamIds?: string[];
  editMode?: boolean;
  onDelete?: () => void;
}

export const PostCreationModal: React.FC<PostCreationModalProps> = ({
  visible,
  onClose,
  onSubmit,
  availableTeams,
  isAdmin,
  isCoach,
  initialTitle = '',
  initialContent = '',
  initialIsGeneral = false,
  initialTeamIds = [],
  editMode = false,
  onDelete,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isGeneral, setIsGeneral] = useState(initialIsGeneral);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(initialTeamIds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setContent(initialContent);
      setIsGeneral(initialIsGeneral);
      setSelectedTeams(initialTeamIds);
      setError(null);
    }
  }, [visible, initialTitle, initialContent, initialIsGeneral, initialTeamIds]);

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleSubmit = async () => {
    setError(null);
    if (!content.trim()) {
      setError('Content is required.');
      return;
    }
    if (!isGeneral && selectedTeams.length === 0) {
      setError('Select at least one team or choose All Teams.');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim() || undefined,
        content: content.trim(),
        is_general: isGeneral,
        team_ids: isGeneral ? [] : selectedTeams,
      });
      setTitle('');
      setContent('');
      setIsGeneral(false);
      setSelectedTeams([]);
      Keyboard.dismiss();
      onClose();
    } catch (e) {
      setError('Failed to create post.');
    } finally {
      setLoading(false);
    }
  };

  const canSelectTeams = isAdmin || isCoach;

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={styles.modal}>
              {/* X Close Button */}
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose} disabled={loading}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.header}>{editMode ? 'Edit Post' : 'New Post'}</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                <TextInput
                  style={styles.input}
                  placeholder="Title (optional)"
                  value={title}
                  onChangeText={setTitle}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    // Focus next input if needed
                  }}
                />
                <TextInput
                  style={[styles.input, { height: 100 }]}
                  placeholder="Share with the team..."
                  value={content}
                  onChangeText={setContent}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                />
                {isAdmin && (
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>All Teams</Text>
                    <Switch value={isGeneral} onValueChange={setIsGeneral} />
                  </View>
                )}
                {canSelectTeams && !isGeneral && (
                  <View style={styles.teamsSection}>
                    <Text style={styles.label}>Select Teams</Text>
                    <View style={styles.teamsList}>
                      {availableTeams.map(team => (
                        <TouchableOpacity
                          key={team.id}
                          style={[
                            styles.teamBadge,
                            selectedTeams.includes(team.id) && styles.teamBadgeSelected,
                          ]}
                          onPress={() => handleTeamToggle(team.id)}
                        >
                          <Text
                            style={[
                              styles.teamText,
                              selectedTeams.includes(team.id) && styles.teamTextSelected,
                            ]}
                          >
                            {team.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {error && <Text style={styles.error}>{error}</Text>}
              </ScrollView>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={loading}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitText}>{editMode ? 'Save' : 'Post'}</Text>
                  )}
                </TouchableOpacity>
              </View>
              {editMode && onDelete && (
                <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} disabled={loading}>
                  <Text style={styles.deleteBtnText}>Delete Post</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '90%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    maxHeight: '90%',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  header: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: COLORS.text,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.grey[300],
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.grey[100],
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    justifyContent: 'space-between',
  },
  label: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  teamsSection: {
    marginBottom: SPACING.md,
  },
  teamsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  teamBadge: {
    backgroundColor: COLORS.grey[200],
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginRight: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  teamBadgeSelected: {
    backgroundColor: COLORS.primary,
  },
  teamText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
  },
  teamTextSelected: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  error: {
    color: COLORS.error,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.grey[300],
    marginRight: SPACING.sm,
  },
  cancelText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  submitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  submitText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  deleteBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: FONT_SIZES.md,
  },
}); 