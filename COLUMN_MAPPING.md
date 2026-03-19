# Niche Platform – DB Column Mapping

This document explains how existing dating-app columns are repurposed for the Niche job platform.
No new columns need to be added; existing schema is reused where possible.

## users table – Column Repurposing

| DB Column               | Original Purpose         | Niche Usage                                |
|-------------------------|--------------------------|--------------------------------------------|
| `orientation`           | Sexual orientation        | **User role**: `'seeker'` or `'employer'`  |
| `occupation`            | Job title                 | **Major Category / Industry**              |
| `employment_type`       | Employment type           | **Sub-Major (seeker) / Work Mode (employer)** |
| `education`             | Education level           | Education level (unchanged)                |
| `country_of_residence`  | Country of residence      | **Current Location / Office Location**     |
| `willing_to_relocate`   | Relocation willingness    | Same meaning (unchanged)                   |
| `smoking`               | Smoking habit             | **Night shift available (seeker)** / Shift type (employer) – `'Yes'`/`'No'` |
| `height`                | Height in cm              | **Minimum monthly salary (seeker)**        |
| `weight`                | Weight in kg              | **Maximum salary budget (employer)**       |
| `liveness_video_url`    | Liveness check video      | **JSON array of video introductions** (seeker) |
| `id_back_url`           | ID back photo             | **JSON array of document vault** (seeker)  |
| `profile_photo_url`     | Profile photo             | Profile photo / Company logo (unchanged)   |

## Preferences – Column Repurposing

| DB Column                    | Original Purpose              | Niche Usage                                                |
|------------------------------|-------------------------------|------------------------------------------------------------|
| `pref_country_of_birth`      | Preferred country of birth    | **Seeker**: preferred work modes (CSV: `"Remote,Hybrid"`)<br>**Employer**: required major category |
| `pref_country_of_residence`  | Preferred country             | **Employer**: required sub-major                           |
| `pref_country`               | Preferred country             | **Seeker**: preferred company sizes (CSV: `"Startup,Corporate"`) |
| `pref_languages`             | Preferred languages           | **Seeker**: target industries (PG array: `{Engineering & Tech}`) |
| `pref_religion`              | Preferred religion            | **Recency filter**: `'today'` or `'any'` (both roles)     |
| `pref_education`             | Preferred education           | **Employer**: minimum required education level             |
| `pref_smoking`               | Smoking preference            | **Employer**: night shift required (`'Yes'`/`'No'`)        |
| `pref_willing_to_relocate`   | Relocation preference         | **Employer**: candidate must be willing to relocate        |
| `pref_gender`                | Gender preference             | **Employer**: preferred candidate gender                   |
| `pref_age_min`               | Minimum age                   | **Employer**: minimum candidate age                        |

## user_interactions table – Action Values

| Action          | Who performs it | Meaning                              |
|-----------------|-----------------|--------------------------------------|
| `applied`       | Seeker          | Seeker applies to employer posting   |
| `shortlisted`   | Employer        | Employer shortlists a seeker         |
| `chat_enabled`  | Employer        | Employer activates chat with seeker  |
| `removed`       | Either          | Removes an interaction               |
| `selected`      | Either (legacy) | Treated as `applied` for seekers     |
| `accepted`      | Either (legacy) | Treated as `chat_enabled` for employers |

## Match Score Algorithm (8 attributes, each worth 1 point)

1. **Work Mode**: seeker's preferred modes vs employer's work mode
2. **Industry**: seeker's target industries vs employer's industry
3. **Company Size**: neutral (1 point always — no company size field on employer profile)
4. **Salary Range**: seeker's min salary ≤ employer's max salary budget
5. **Relocation**: employer requires relocation → seeker must be willing
6. **Night Shift**: employer requires night shift → seeker must be available
7. **Education**: seeker's education ≥ employer's minimum required level
8. **Major Category**: seeker's major matches employer's required major
