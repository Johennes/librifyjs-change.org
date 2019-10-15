// Copyright 2019 Johannes Marbach
//
// This file is part of "LibrifyJS: change.org", hereafter referred
// to as the program.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

(() => {
    let clientDataObj = extractClientData()
    let appDataObj = extractAppData()
    if (!clientDataObj && !appDataObj) {
        console.error('LibrifyJS: Could not located client or app data')
        return
    }

    normalizeFormFields()
    connectAddressButtonClick()
    connectSubmitButtonClick()

    // Site Data Extraction

    function extractClientData() {
        let clientData = document.querySelector('script#clientData'), clientDataObj = null
        if (clientData) {
            console.log('LibrifyJS: Located client data')
            return JSON.parse(clientData.textContent)
        }
    }

    function extractAppData() {
        let appData = document.querySelector('script#app-data'), appDataObj = null
        if (appData) {
            console.log('LibrifyJS: Located app data')
            return JSON.parse(appData.textContent)
        }
    }

    // Form Field Normalization

    function normalizeFormFields() {
        let firstNameInput = document.querySelector('input[name=firstName]')
        if (firstNameInput) {
            firstNameInput.setAttribute('name', 'first_name')
        }
        let lastNameInput = document.querySelector('input[name=lastName]')
        if (lastNameInput) {
            lastNameInput.setAttribute('name', 'last_name')
        }
    }

    // Address Editing

    function connectAddressButtonClick() {
        let button = document.querySelector('form[name=sign-form] button[type=button]')
        if (!button) {
            button = document.querySelector('div.js-edit-address')
            if (!button) {
                console.warn('LibrifyJS: Could not locate address button')
                return
            }
        }
        button.addEventListener('click', (event) => {
            button.insertAdjacentHTML('afterend', createAddressFields())
            button.parentNode.removeChild(button)
            connectCountryFieldChange()
        })
    }

    function createAddressFields() {
        return minifyHtml(`
            <div class="js-address-fields">
                ${createCountryField()}
                ${createCityField()}
                ${createStateField()}
                ${createPostalCodeField()}
            </div>`)
    }

    function createCountryField() {
        let sortedCodes = Object.keys(countries).sort((one, other) => countries[one] > countries[other])
        let sortedOptions = sortedCodes.map(code => `<option value="${code}">${countries[code]}</option>`)
        return `
            <div class="control-group">
                <div class="control">
                    <div class="input">
                        <div class="form-select">
                            <select name="country_code" autocomplete="country-name">
                                <option value="">Country</option>
                                ${sortedOptions}
                            </select>
                        </div>
                    </div>
                </div>
            </div>`
    }

    function createCityField() {
        return `
            <div class="control-group">
                <div class="control">
                    <div class="input">
                        <input placeholder="City" value="" name="city" type="text">
                    </div>
                </div>
            </div>`
    }

    function createStateField() {
        return `
            <div class="control-group">
                <div class="control">
                    <div class="input">
                        <div class="form-select">
                            <select autocomplete="state" name="state_code" style="display: none;"></select>
                        </div>
                    </div>
                </div>
            </div>`
    }

    function createPostalCodeField() {
        return `
            <div class="control-group">
                <div class="control">
                    <div class="input">
                        <input placeholder="Postal code" value="" name="postal_code" type="text" style="display: none;"></span>
                    </div>
                </div>
            </div>`
    }

    function connectCountryFieldChange() {
        let countryField = document.querySelector('select[name=country_code]')
        if (!countryField) {
            console.warn('LibrifyJS: Could not locate country field')
            return
        }
        countryField.addEventListener('change', (event) => {
            updateStateField(countryField.value)
            updatePostalCodeField(countryField.value)
        })
    }

    function updateStateField(countryCode) {
        let stateField = document.querySelector('select[name=state_code]')
        if (!stateField) {
            console.warn('LibrifyJS: Could not locate state field')
            return
        }
        let statesForCountry = states[countryCode]
        if (statesForCountry) {
            stateField.innerHTML = `<option value="">State</option>${statesForCountry.map(state => `<option>${state}</option>`)}`
            stateField.style.display = 'block'
        } else {
            stateField.innerHTML = ''
            stateField.style.display = 'none'
        }
    }

    function updatePostalCodeField(countryCode) {
        let postalCodeField = document.querySelector('input[name=postal_code]')
        if (!postalCodeField) {
            console.warn('LibrifyJS: Could not locate postal code field field')
            return
        }
        if (postalCodeRequired[countryCode]) {
            postalCodeField.style.display = 'block'
        } else {
            postalCodeField.value = ''
            postalCodeField.style.display = 'none'
        }
    }

    // Form Submission

    function connectSubmitButtonClick() {
        let button = document.querySelector('button[type=submit]')
        if (!button) {
            console.warn('LibrifyJS: Could not locate submit button')
            return
        }
        button.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            submitForm()
        })
    }

    function submitForm() {
        let csrfToken = appDataObj ? getCsrfTokenFromAppData(appDataObj) : getCsrfTokenFromClientData(clientDataObj)
        if (!csrfToken) {
            console.error('LibrifyJS: Could not locate CSRF token')
            return
        }
        let petitionId = appDataObj ? getPetitionIdFromAppData(appDataObj) : getPetitionIdFromClientData(clientDataObj)
        if (!petitionId) {
            console.error('LibrifyJS: Could not locate petition ID')
            return
        }
        let formData = getFormData(petitionId, clientDataObj)
        if (!formData) {
            console.error('LibrifyJS: Could not load form data')
            return
        }
        fetch(createRequest(csrfToken, petitionId, formData))
            .then(response => response.json())
            .catch(onSubmissionError)
            .then(json => {
                let redirectUrl = json['redirect_to']
                if (!redirectUrl) {
                    onSubmissionError(`${JSON.stringify(json)}`)
                    return
                }
                window.location.href = redirectUrl
            })
    }

    function getCsrfTokenFromAppData(appData) {
        let apolloState = appData['apolloState']
        if (!apolloState) {
            return null
        }
        let appState = apolloState['$ROOT_QUERY.appState']
        if (!appState) {
            return null
        }
        return appState['csrfToken']
    }

    function getCsrfTokenFromClientData(clientData) {
        let appData = clientData['appData']
        if (!appData) {
            return null
        }
        return appData['csrfToken']
    }

    function getPetitionIdFromAppData(appData) {
        let apolloState = appData['apolloState']
        if (!apolloState) {
            return null
        }
        for (key in apolloState) {
            if (!key.startsWith('Petition') || !apolloState.hasOwnProperty(key)) {
                continue
            }
            return key.replace(/^Petition:/, '')
        }
    }
    
    function getPetitionIdFromClientData(clientData) {
        let bootstrapData = clientData['bootstrapData']
        if (!bootstrapData) {
            return null
        }
        let model = bootstrapData['model']
        if (!model) {
            return null
        }
        let summary = model['summary']
        if (!summary) {
            return null
        }
        return summary.id
    }

    function getFirstNameFromClientData(clientData) {
        let appData = clientData['appData']
        if (!appData) {
            return null
        }
        let user = appData['currentUser']
        if (!user) {
            return null
        }
        return user['first_name']
    }

    function getLastNameFromClientData(clientData) {
        let appData = clientData['appData']
        if (!appData) {
            return null
        }
        let user = appData['currentUser']
        if (!user) {
            return null
        }
        return user['last_name']
    }

    function getCityFromClientData(clientData) {
        let appData = clientData['appData']
        if (!appData) {
            return null
        }
        let user = appData['currentUser']
        if (!user) {
            return null
        }
        return user['city']
    }

    function getStateFromClientData(clientData) {
        let appData = clientData['appData']
        if (!appData) {
            return null
        }
        let user = appData['currentUser']
        if (!user) {
            return null
        }
        return user['state_code']
    }

    function getCountryFromClientData(clientData) {
        let appData = clientData['appData']
        if (!appData) {
            return null
        }
        let user = appData['currentUser']
        if (!user) {
            return null
        }
        return user['country_code']
    }

    function getEmailFromClientData(clientData) {
        let appData = clientData['appData']
        if (!appData) {
            return null
        }
        let user = appData['currentUser']
        if (!user) {
            return null
        }
        return user['email']
    }

    function getFormData(petitionId, clientData) {
        let form = document.querySelector('form[name=sign-form]')
        if (!form) {
            form = document.querySelector('form.sign')
            if (!form) {
                return
            }
        }
        let formData = new FormData(form)
        if (!formData.get('petition_id')) {
            formData.append('petition_id', petitionId)
        }
        if (!formData.get('first_name') && clientData) {
            formData.append('first_name', getFirstNameFromClientData(clientData))
        }
        if (!formData.get('last_name') && clientData) {
            formData.append('last_name', getLastNameFromClientData(clientData))
        }
        if (!formData.get('city') && clientData) {
            formData.append('city', getCityFromClientData(clientData))
        }
        if (!formData.get('state_code') && clientData) {
            formData.append('state_code', getStateFromClientData(clientData))
        }
        if (!formData.get('country_code') && clientData) {
            formData.append('country_code', getCountryFromClientData(clientData))
        }
        if (!formData.get('email') && clientData) {
            formData.append('email', getEmailFromClientData(clientData))
        }
        let marketingConsentSelection = document.querySelector('input[name=marketing_comms_consent]:checked')
        formData.append('marketing_comms_consent', marketingConsentSelection ? marketingConsentSelection.value : false)
        let shareInfoInput = document.querySelector('input[name=share_info]')
        formData.append('share_info', shareInfoInput ? shareInfoInput.checked : false)
        let notPublicInput = document.querySelector('input[name=not_public]')
        formData.append('public', notPublicInput ? !notPublicInput.checked : false)
        return formData        
    }

    function createRequest(csrfToken, petitionId, formData) {
        return new Request(`https://www.change.org/api-proxy/-/signatures/${petitionId}`, {
            'credentials': 'include',
            referrer: window.location.href,
            body: createBody(formData),
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
    }

    function createBody(formData) {
        let body = {}
        formData.forEach((value, key) => {
            body[key] = value
        })
        return JSON.stringify(body)
    }

    function onSubmissionError(error) {
        console.warn(`LibrifyJS: Form submission failed - ${error}`)
        alert(`${error}`)
    }

    // Utils

    function minifyHtml(string) {
        return string.replace(/^\s*|\s*$/gm, '').replace(/\r?\n|\r/g, '')
    }

    // Data

    let countries = {
        'AF': 'Afghanistan', '002': 'Africa', 'AL': 'Albania', 'DZ': 'Algeria',
        'AS': 'American Samoa', '019': 'Americas', 'AD': 'Andorra', 'AO': 'Angola',
        'AI': 'Anguilla', 'AQ': 'Antarctica', 'AG': 'Antigua &amp; Barbuda', 'AR': 'Argentina',
        'AM': 'Armenia', 'AW': 'Aruba', 'AC': 'Ascension Island', '142': 'Asia',
        '053': 'Australasia', 'AU': 'Australia', 'AT': 'Austria', 'AZ': 'Azerbaijan',
        'BS': 'Bahamas', 'BH': 'Bahrain', 'BD': 'Bangladesh', 'BB': 'Barbados', 'BY': 'Belarus',
        'BE': 'Belgium', 'BZ': 'Belize', 'BJ': 'Benin', 'BM': 'Bermuda', 'BT': 'Bhutan',
        'BO': 'Bolivia', 'BA': 'Bosnia &amp; Herzegovina', 'BW': 'Botswana', 'BV': 'Bouvet Island',
        'BR': 'Brazil', 'IO': 'British Indian Ocean Territory', 'VG': 'British Virgin Islands',
        'BN': 'Brunei', 'BG': 'Bulgaria', 'BF': 'Burkina Faso', 'BI': 'Burundi', 'KH': 'Cambodia',
        'CM': 'Cameroon', 'CA': 'Canada', 'IC': 'Canary Islands', 'CV': 'Cape Verde',
        '029': 'Caribbean', 'BQ': 'Caribbean Netherlands', 'KY': 'Cayman Islands',
        'CF': 'Central African Republic', '013': 'Central America', '143': 'Central Asia',
        'EA': 'Ceuta &amp; Melilla', 'TD': 'Chad', 'CL': 'Chile', 'CN': 'China',
        'CX': 'Christmas Island', 'CP': 'Clipperton Island', 'CC': 'Cocos (Keeling) Islands',
        'CO': 'Colombia', 'KM': 'Comoros', 'CG': 'Congo - Brazzaville', 'CD': 'Congo - Kinshasa',
        'CK': 'Cook Islands', 'CR': 'Costa Rica', 'HR': 'Croatia', 'CU': 'Cuba', 'CW': 'Curaçao',
        'CY': 'Cyprus', 'CZ': 'Czechia', 'CI': 'Côte d’Ivoire', 'DK': 'Denmark',
        'DG': 'Diego Garcia', 'DJ': 'Djibouti', 'DM': 'Dominica', 'DO': 'Dominican Republic',
        '014': 'Eastern Africa', '030': 'Eastern Asia', '151': 'Eastern Europe', 'EC': 'Ecuador',
        'EG': 'Egypt', 'SV': 'El Salvador', 'GQ': 'Equatorial Guinea', 'ER': 'Eritrea',
        'EE': 'Estonia', 'ET': 'Ethiopia', '150': 'Europe', 'EZ': 'Eurozone',
        'FK': 'Falkland Islands', 'FO': 'Faroe Islands', 'FJ': 'Fiji', 'FI': 'Finland',
        'FR': 'France', 'GF': 'French Guiana', 'PF': 'French Polynesia',
        'TF': 'French Southern Territories', 'GA': 'Gabon', 'GM': 'Gambia', 'GE': 'Georgia',
        'DE': 'Germany', 'GH': 'Ghana', 'GI': 'Gibraltar', 'GR': 'Greece', 'GL': 'Greenland',
        'GD': 'Grenada', 'GP': 'Guadeloupe', 'GU': 'Guam', 'GT': 'Guatemala', 'GG': 'Guernsey',
        'GN': 'Guinea', 'GW': 'Guinea-Bissau', 'GY': 'Guyana', 'HT': 'Haiti',
        'HM': 'Heard &amp; McDonald Islands', 'HN': 'Honduras', 'HK': 'Hong Kong SAR China',
        'HU': 'Hungary', 'IS': 'Iceland', 'IN': 'India', 'ID': 'Indonesia', 'IR': 'Iran',
        'IQ': 'Iraq', 'IE': 'Ireland', 'IM': 'Isle of Man', 'IL': 'Israel', 'IT': 'Italy',
        'JM': 'Jamaica', 'JP': 'Japan', 'JE': 'Jersey', 'JO': 'Jordan', 'KZ': 'Kazakhstan',
        'KE': 'Kenya', 'KI': 'Kiribati', 'XK': 'Kosovo', 'KW': 'Kuwait', 'KG': 'Kyrgyzstan',
        'LA': 'Laos', '419': 'Latin America', 'LV': 'Latvia', 'LB': 'Lebanon', 'LS': 'Lesotho',
        'LR': 'Liberia', 'LY': 'Libya', 'LI': 'Liechtenstein', 'LT': 'Lithuania',
        'LU': 'Luxembourg', 'MO': 'Macau SAR China', 'MK': 'Macedonia', 'MG': 'Madagascar',
        'MW': 'Malawi', 'MY': 'Malaysia', 'MV': 'Maldives', 'ML': 'Mali', 'MT': 'Malta',
        'MH': 'Marshall Islands', 'MQ': 'Martinique', 'MR': 'Mauritania', 'MU': 'Mauritius',
        'YT': 'Mayotte', '054': 'Melanesia', 'MX': 'Mexico', 'FM': 'Micronesia',
        '057': 'Micronesian Region', '017': 'Middle Africa', 'MD': 'Moldova', 'MC': 'Monaco',
        'MN': 'Mongolia', 'ME': 'Montenegro', 'MS': 'Montserrat', 'MA': 'Morocco',
        'MZ': 'Mozambique', 'MM': 'Myanmar (Burma)', 'NA': 'Namibia', 'NR': 'Nauru', 'NP': 'Nepal',
        'NL': 'Netherlands', 'NC': 'New Caledonia', 'NZ': 'New Zealand', 'NI': 'Nicaragua',
        'NE': 'Niger', 'NG': 'Nigeria', 'NU': 'Niue', 'NF': 'Norfolk Island',
        '003': 'North America', 'KP': 'North Korea', '015': 'Northern Africa',
        '021': 'Northern America', '154': 'Northern Europe', 'MP': 'Northern Mariana Islands',
        'NO': 'Norway', '009': 'Oceania', 'OM': 'Oman', 'QO': 'Outlying Oceania', 'PK': 'Pakistan',
        'PW': 'Palau', 'PS': 'Palestinian Territories', 'PA': 'Panama', 'PG': 'Papua New Guinea',
        'PY': 'Paraguay', 'PE': 'Peru', 'PH': 'Philippines', 'PN': 'Pitcairn Islands',
        'PL': 'Poland', '061': 'Polynesia', 'PT': 'Portugal', 'XA': 'Pseudo-Accents',
        'XB': 'Pseudo-Bidi', 'PR': 'Puerto Rico', 'QA': 'Qatar', 'RO': 'Romania', 'RU': 'Russia',
        'RW': 'Rwanda', 'RE': 'Réunion', 'WS': 'Samoa', 'SM': 'San Marino', 'SA': 'Saudi Arabia',
        'SN': 'Senegal', 'RS': 'Serbia', 'SC': 'Seychelles', 'SL': 'Sierra Leone',
        'SG': 'Singapore', 'SX': 'Sint Maarten', 'SK': 'Slovakia', 'SI': 'Slovenia',
        'SB': 'Solomon Islands', 'SO': 'Somalia', 'ZA': 'South Africa', '005': 'South America',
        'GS': 'South Georgia &amp; South Sandwich Islands', 'KR': 'South Korea',
        'SS': 'South Sudan', '035': 'Southeast Asia', '018': 'Southern Africa',
        '034': 'Southern Asia', '039': 'Southern Europe', 'ES': 'Spain', 'LK': 'Sri Lanka',
        'BL': 'St. Barthélemy', 'SH': 'St. Helena', 'KN': 'St. Kitts &amp; Nevis',
        'LC': 'St. Lucia', 'MF': 'St. Martin', 'PM': 'St. Pierre &amp; Miquelon',
        'VC': 'St. Vincent &amp; Grenadines', '202': 'Sub-Saharan Africa', 'SD': 'Sudan',
        'SR': 'Suriname', 'SJ': 'Svalbard &amp; Jan Mayen', 'SZ': 'Swaziland', 'SE': 'Sweden',
        'CH': 'Switzerland', 'SY': 'Syria', 'ST': 'São Tomé &amp; Príncipe', 'TW': 'Taiwan',
        'TJ': 'Tajikistan', 'TZ': 'Tanzania', 'TH': 'Thailand', 'TL': 'Timor-Leste', 'TG': 'Togo',
        'TK': 'Tokelau', 'TO': 'Tonga', 'TT': 'Trinidad &amp; Tobago', 'TA': 'Tristan da Cunha',
        'TN': 'Tunisia', 'TR': 'Turkey', 'TM': 'Turkmenistan', 'TC': 'Turks &amp; Caicos Islands',
        'TV': 'Tuvalu', 'UM': 'U.S. Outlying Islands', 'VI': 'U.S. Virgin Islands', 'UG': 'Uganda',
        'UA': 'Ukraine', 'AE': 'United Arab Emirates', 'GB': 'United Kingdom',
        'UN': 'United Nations', 'US': 'United States', 'ZZ': 'Unknown Region', 'UY': 'Uruguay',
        'UZ': 'Uzbekistan', 'VU': 'Vanuatu', 'VA': 'Vatican City', 'VE': 'Venezuela',
        'VN': 'Vietnam', 'WF': 'Wallis &amp; Futuna', '011': 'Western Africa',
        '145': 'Western Asia', '155': 'Western Europe', 'EH': 'Western Sahara', '001': 'World',
        'YE': 'Yemen', 'ZM': 'Zambia', 'ZW': 'Zimbabwe', 'AX': 'Åland Islands'
    }

    let states = {
        'US': [
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL',
            'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE',
            'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD',
            'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'AS', 'FM', 'GU', 'MH', 'MP',
            'PW', 'PR', 'VI', 'AA', 'AE', 'AP'
        ]
    }

    let postalCodeRequired = {
        'AR': true, 'AU': true, 'CA': true, 'DE': true, 'ES': true, 'FR': true, 'GB': true,
        'GF': true, 'GP': true, 'ID': true, 'IN': true, 'IT': true, 'JP': true, 'MQ': true,
        'MX': true, 'NC': true, 'NL': true, 'PF': true, 'PM': true, 'PT': true, 'RE': true,
        'US': true, 'WF': true, 'YT': true
    }

    let gdrpRequired = {
        'AT': true, 'AX': true, 'BE': true, 'BG': true, 'BL': true, 'BV': true, 'CE': true,
        'CH': true, 'CY': true, 'CZ': true, 'DE': true, 'DK': true, 'EE': true, 'ES': true,
        'EU': true, 'FI': true, 'FO': true, 'FR': true, 'GB': true, 'GF': true, 'GG': true,
        'GI': true, 'GP': true, 'GR': true, 'HR': true, 'HU': true, 'IE': true, 'IM': true,
        'IO': true, 'IS': true, 'IT': true, 'JE': true, 'LI': true, 'LT': true, 'LU': true,
        'LV': true, 'MC': true, 'MF': true, 'MQ': true, 'MS': true, 'MT': true, 'NC': true,
        'NL': true, 'NO': true, 'PF': true, 'PL': true, 'PM': true, 'PT': true, 'RE': true,
        'RO': true, 'SE': true, 'SI': true, 'SJ': true, 'SK': true, 'SM': true, 'TF': true,
        'TG': true, 'UK': true, 'VA': true, 'WF': true, 'YT': true
    }
})()
