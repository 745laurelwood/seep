import React from 'react';
import { CardComponent as SharedCard, CardComponentProps } from '@laurelwood/card-class';

interface SeepCardProps extends Omit<CardComponentProps, 'frameClassName' | 'selectionTone'> {
  /** Part of a house on the floor. */
  isHouse?: boolean;
  /** That house is cemented, so it can no longer be added to. */
  isCementedHouse?: boolean;
}

const HOUSE_RING = 'ring-2 ring-[color:var(--accent-soft)]';
const CEMENTED_RING = 'ring-2 ring-[color:var(--gold)]';

/**
 * The shared card with Seep's two additions: houses are ringed, and
 * selection reads red rather than the package's default accent, because in
 * Seep selecting a card is a commitment rather than a hint.
 */
export const CardComponent: React.FC<SeepCardProps> = ({ isHouse, isCementedHouse, ...rest }) => (
  <SharedCard
    {...rest}
    selectionTone="red"
    frameClassName={isHouse ? (isCementedHouse ? CEMENTED_RING : HOUSE_RING) : ''}
  />
);
