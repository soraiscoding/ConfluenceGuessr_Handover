import React, { useState } from 'react';
import { ButtonThemes } from './componentThemes';

// this button can cycle through the different values in an array each time it's clicked
function Button ({ text = "hey baus!!",  values=[], currValue, onClick }) {
	if (!values || values.length === 0) return null;
	if (!text) return null;

	const handleClick = () => {
		const currentIndex = values.indexOf(currValue);
		const nextIndex = (currentIndex + 1) % values.length;

		onClick(values[nextIndex]);
	}

	return (
		<button className={ButtonThemes.default_primary} onClick={handleClick}> 
			{text} {currValue} 
		</button>
	)
}

export default Button;